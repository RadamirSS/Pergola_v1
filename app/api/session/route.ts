import { env } from 'cloudflare:workers';
import { body, failure, HttpError, json } from '../../../lib/server';
export async function POST(request: Request) {
  try {
    const origin=request.headers.get('origin');if(origin && new URL(origin).host!==new URL(request.url).host)throw new HttpError(403,'Origine non consentita.');
    const data=await body(request);const token=(env as Cloudflare.Env & {ADMIN_TOKEN?:string}).ADMIN_TOKEN;
    if(!token || typeof data.token!=='string' || data.token!==token)throw new HttpError(401,'Codice di accesso non valido.');
    const response=json({ok:true});response.headers.set('Set-Cookie',`pergola_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`);return response;
  } catch(error) {return failure(error);}
}
