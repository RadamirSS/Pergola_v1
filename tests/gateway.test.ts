import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticated, proxy, signIn } from '../vercel/lib/gateway.ts';

test('gateway requires authentication, issues expiring signed cookies and blocks cross-origin writes', async () => {
  process.env.ADMIN_TOKEN = 'test-only-access-secret';
  const request = (path: string, options?: RequestInit) => new Request(`https://pergola.example${path}`, options);
  assert.equal((await proxy(request('/api/workspace'))).status, 401);
  assert.equal((await signIn(request('/api/session', { method: 'POST', body: JSON.stringify({ token: 'wrong' }) }))).status, 401);
  const login = await signIn(request('/api/session', { method: 'POST', headers: { Origin: 'https://pergola.example' }, body: JSON.stringify({ token: process.env.ADMIN_TOKEN }) }));
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  assert.ok(!cookie.includes(process.env.ADMIN_TOKEN));
  assert.equal(authenticated(request('/api/workspace', { headers: { Cookie: cookie.split(';')[0] } })), true);
  assert.equal(authenticated(request('/api/workspace', { headers: { Cookie: 'pergola_session=1.invalid' } })), false);
  const forged = request('/api/quotes', { method: 'POST', headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}`, Origin: 'https://evil.example' }, body: '{}' });
  assert.equal((await proxy(forged)).status, 403);
});

test('gateway forwards only allowed API paths, keeps credentials private and streams PDFs', async () => {
  process.env.ADMIN_TOKEN = 'test-only-access-secret';
  process.env.PERGOLA_BACKEND_URL = 'https://backend.example';
  process.env.PERGOLA_BACKEND_TOKEN = 'test-only-service-secret';
  const original = globalThis.fetch;
  try {
    let seen = false;
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), 'https://backend.example/api/quotes/7/pdf');
      const headers = new Headers(options?.headers);
      assert.equal(headers.get('OAI-Sites-Authorization'), 'Bearer test-only-service-secret');
      assert.equal(headers.get('Origin'), 'https://backend.example');
      assert.equal(headers.get('Cookie'), null);
      assert.equal(headers.get('Authorization'), null);
      seen = true;
      return new Response('%PDF-test', { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="test.pdf"', 'Set-Cookie': 'upstream-secret=hidden' } });
    };
    const response = await proxy(new Request('https://pergola.example/api/quotes/7/pdf', { headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}`, Cookie: 'unrelated=value' } }));
    assert.equal(seen, true);
    assert.equal(await response.text(), '%PDF-test');
    assert.match(response.headers.get('content-type')!, /pdf/);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('oai-sites-authorization'), null);
    assert.equal((await proxy(new Request('https://pergola.example/api/unknown'))).status, 404);
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: 'https://login.example' } });
    assert.equal((await proxy(new Request('https://pergola.example/api/workspace', { headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` } }))).status, 502);
  } finally { globalThis.fetch = original; }
});
