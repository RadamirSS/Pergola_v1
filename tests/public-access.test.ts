import test from 'node:test';
import assert from 'node:assert/strict';
import { proxy, visitorSession } from '../vercel/lib/gateway.ts';
import { guestOwner, guestSelectionAllowed, ownerScope } from '../lib/guest-policy.ts';
import { emptySelection } from '../lib/pricing.ts';
import catalog from '../data/catalog.json' with { type: 'json' };
import type { Product } from '../lib/types.ts';

test('public calculator needs no login and uses a signed isolated visitor identity', async () => {
  process.env.ADMIN_TOKEN = 'unit-test-admin';
  process.env.PERGOLA_BACKEND_URL = 'https://backend.example';
  process.env.PERGOLA_BACKEND_TOKEN = 'unit-test-platform';
  process.env.PERGOLA_GATEWAY_TOKEN = 'unit-test-bridge';
  const a = visitorSession(new Request('https://pergola.example/api/workspace'));
  const b = visitorSession(new Request('https://pergola.example/api/workspace'));
  assert.notEqual(a.id, b.id);
  assert.equal(visitorSession(new Request('https://pergola.example/api/workspace', { headers: { Cookie: a.cookie!.split(';')[0] } })).id, a.id);
  assert.notEqual(visitorSession(new Request('https://pergola.example/api/workspace', { headers: { Cookie: a.cookie!.replace(a.id, b.id).split(';')[0] } })).id, b.id);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_, options) => {
      const headers = new Headers(options?.headers);
      assert.equal(headers.get('x-pergola-guest'), a.id);
      assert.equal(headers.get('x-pergola-gateway'), 'unit-test-bridge');
      assert.equal(headers.get('authorization'), null);
      return Response.json({ catalog: { products: [] } });
    };
    const result = await proxy(new Request('https://pergola.example/api/workspace', { headers: { Cookie: a.cookie!.split(';')[0] } }));
    assert.equal(result.status, 200);
    assert.equal((await proxy(new Request('https://pergola.example/api/admin', { method: 'PUT', body: '{}' }))).status, 403);
    assert.equal((await proxy(new Request('https://pergola.example/api/manage/quotes'))).status, 401);
  } finally { globalThis.fetch = original; }
});

test('backend guest scope cannot impersonate an admin or grant commercial privileges', () => {
  const id = '12345678-1234-4234-8234-123456789abc';
  const owner = guestOwner('valid-bridge', 'valid-bridge', id)!;
  assert.equal(owner, `guest:${id}`);
  assert.equal(guestOwner('valid-bridge', 'forged', id), null);
  assert.equal(guestOwner(undefined, 'valid-bridge', id), null);
  assert.equal(ownerScope(owner), owner);
  assert.equal(ownerScope('administrator'), '');
  const selection = emptySelection(catalog.products[0] as Product);
  assert.equal(guestSelectionAllowed(owner, selection), true);
  assert.equal(guestSelectionAllowed(owner, selection, true), false);
  assert.equal(guestSelectionAllowed(owner, { ...selection, discountBasisPoints: 5000 }), false);
  assert.equal(guestSelectionAllowed(owner, { ...selection, installationCents: 1 }), false);
  assert.equal(guestSelectionAllowed('administrator', { ...selection, discountBasisPoints: 1000 }, true), true);
});
