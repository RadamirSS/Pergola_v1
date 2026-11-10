import type { Selection } from './types';
export const isGuest = (owner: string) => owner.startsWith('guest:');
export const ownerScope = (owner: string) => isGuest(owner) ? owner : '';
export function guestOwner(secret: string | undefined, supplied: string | null, id: string | null): string | null {
  if (!secret || !supplied || secret.length !== supplied.length || !id || !/^[a-f0-9-]{36}$/.test(id)) return null;
  let different = 0;
  for (let i = 0; i < secret.length; i++) different |= secret.charCodeAt(i) ^ supplied.charCodeAt(i);
  return different ? null : `guest:${id}`;
}
export function guestSelectionAllowed(owner: string, selection: Selection, issue = false) {
  return !isGuest(owner) || (!issue && selection.discountBasisPoints === 0 && selection.installationCents === 0 && selection.deliveryCents === 0);
}
