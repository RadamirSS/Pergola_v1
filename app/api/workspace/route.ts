import { authorize, failure, json, loadWorkspace, quoteScope } from '../../../lib/server';
export async function GET(request: Request) {
  try { authorize(request); const data = await loadWorkspace(); if (quoteScope(request)) data.reviews = Object.fromEntries(Object.entries(data.reviews).map(([id, review]) => [id, { ...review, note: '' }])); return json(data); } catch (error) { return failure(error); }
}
