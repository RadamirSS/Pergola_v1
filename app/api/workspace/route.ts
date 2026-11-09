import { authorize, failure, json, loadWorkspace } from '../../../lib/server';
export async function GET(request: Request) {
  try { authorize(request); return json(await loadWorkspace()); } catch (error) { return failure(error); }
}
