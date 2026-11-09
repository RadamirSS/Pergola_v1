import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const cookieName = 'pergola_session';
const lifetime = 12 * 60 * 60;
const allowed = /^\/api\/(?:workspace|calculate|admin|health|quotes(?:\/[1-9]\d*(?:\/pdf)?)?)$/;
const problem = (status: number, error: string) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
function equal(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
function signature(value: string) {
  return createHmac('sha256', process.env.ADMIN_TOKEN ?? '').update(value).digest('base64url');
}
function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return request.headers.get('sec-fetch-site') !== 'cross-site' && (!origin || origin === new URL(request.url).origin);
}
export function authenticated(request: Request) {
  if (!process.env.ADMIN_TOKEN) return false;
  const bearer = request.headers.get('authorization');
  if (bearer && equal(bearer, `Bearer ${process.env.ADMIN_TOKEN}`)) return true;
  const cookie = request.headers.get('cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!cookie) return false;
  const [expiry, signed, extra] = cookie.split('.');
  const timestamp = Number(expiry);
  const now = Math.floor(Date.now() / 1000);
  return !extra && Number.isSafeInteger(timestamp) && timestamp > now && timestamp <= now + lifetime && !!signed && equal(signed, signature(expiry));
}
export async function signIn(request: Request) {
  if (!sameOrigin(request)) return problem(403, 'Origine non consentita.');
  if (!process.env.ADMIN_TOKEN) return problem(503, 'Accesso non configurato.');
  if (Number(request.headers.get('content-length')) > 2000) return problem(413, 'Richiesta troppo grande.');
  let data: { token?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 2000) return problem(413, 'Richiesta troppo grande.');
    data = JSON.parse(raw);
  } catch { return problem(400, 'Richiesta non valida.'); }
  if (!data || typeof data.token !== 'string' || !equal(data.token, process.env.ADMIN_TOKEN)) return problem(401, 'Codice di accesso non valido.');
  const expiry = String(Math.floor(Date.now() / 1000) + lifetime);
  return Response.json({ ok: true }, { headers: {
    'Cache-Control': 'no-store',
    'Set-Cookie': `${cookieName}=${expiry}.${signature(expiry)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${lifetime}`,
  } });
}
/** Vercel terminates the browser session; only the server knows the D1 service credential. */
export async function proxy(request: Request) {
  const incoming = new URL(request.url);
  if (!allowed.test(incoming.pathname)) return problem(404, 'Risorsa non trovata.');
  if (!authenticated(request)) return problem(401, 'Inserisci il codice di accesso amministratore per continuare.');
  if (!['GET', 'POST', 'PUT', 'PATCH'].includes(request.method)) return problem(405, 'Metodo non consentito.');
  if (request.method !== 'GET' && !sameOrigin(request)) return problem(403, 'Origine non consentita.');
  const backend = process.env.PERGOLA_BACKEND_URL;
  const credential = process.env.PERGOLA_BACKEND_TOKEN;
  if (!backend || !credential) return problem(503, 'Archivio non configurato.');
  try {
    const destination = new URL(incoming.pathname + incoming.search, backend);
    if (destination.protocol !== 'https:' || destination.origin !== new URL(backend).origin) return problem(503, 'Archivio non configurato.');
    let body: string | undefined;
    if (request.method !== 'GET') {
      if (Number(request.headers.get('content-length')) > 3000000) return problem(413, 'Il file supera il limite di 3 MB.');
      body = await request.text();
      if (Buffer.byteLength(body) > 3000000) return problem(413, 'Il file supera il limite di 3 MB.');
    }
    const upstream = await fetch(destination, {
      method: request.method, body, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(45000),
      headers: { 'Content-Type': 'application/json', 'Origin': destination.origin, 'OAI-Sites-Authorization': `Bearer ${credential}` },
    });
    // Redirects or an HTML login screen mean service authentication failed.
    if (upstream.status >= 300 && upstream.status < 400 || upstream.headers.get('content-type')?.includes('text/html')) return problem(502, 'Connessione all’archivio non disponibile.');
    const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    for (const key of ['content-type', 'content-disposition']) {
      const value = upstream.headers.get(key); if (value) headers.set(key, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch { return problem(503, 'Archivio temporaneamente non raggiungibile. Riprova.'); }
}
