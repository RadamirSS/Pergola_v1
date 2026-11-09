import { database, failure, json } from '../../../lib/server';
export async function GET() { try { await database().prepare('SELECT 1 AS ok').first(); return json({ status: 'ok', ai: 'disabled' }); } catch (error) { return failure(error); } }
