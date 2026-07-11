import { pb } from './db';

// PocketBase schema for the PIN feature:
//
//   Collection: player_pins
//     name_key  (text, unique index) — normalizeName(user) of the owner
//     salt      (text, required)     — hex, 16 random bytes per record
//     pin_hash  (text, required)     — hex SHA-256 of `${salt}:${pin}`
//
// Rules: List/View/Create/Update/Delete → left OPEN. The trust model is
// "friends won't grief each other" — knowing the hash doesn't reveal the
// PIN, but there is no server-enforced ownership check because there is
// no real authentication in the app.
//
// If the collection is missing or the API rejects the call, the client
// degrades to "no PIN configured" so sign-in still works.

const COLLECTION = 'player_pins';

export interface PinRecord {
  id: string;
  name_key: string;
  salt: string;
  pin_hash: string;
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const randomSalt = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
};

export const hashPin = async (salt: string, pin: string): Promise<string> => {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
};

const escapeFilterValue = (v: string) => v.replace(/"/g, '\\"');

export const getPinRecord = async (nameKey: string): Promise<PinRecord | null> => {
  try {
    return await pb
      .collection(COLLECTION)
      .getFirstListItem<PinRecord>(`name_key="${escapeFilterValue(nameKey)}"`);
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status;
    // 404 — no PIN set. 400/403 — collection missing or rules deny.
    // In all of these we treat it as "no PIN" so the app still works
    // even if the PB collection hasn't been created yet.
    if (status === 404 || status === 400 || status === 403) return null;
    throw e;
  }
};

export const verifyAgainstRecord = async (
  rec: PinRecord,
  pin: string,
): Promise<boolean> => (await hashPin(rec.salt, pin)) === rec.pin_hash;

const asWriteError = (e: unknown): Error => {
  const err = e as { status?: number; message?: string };
  if (err?.status === 404 || /collection.*context/i.test(err?.message ?? '')) {
    return new Error(
      `PIN storage isn't set up. Create a "${COLLECTION}" collection in ` +
        `PocketBase (fields: name_key, salt, pin_hash) with public API rules.`,
    );
  }
  return e instanceof Error ? e : new Error(String(e));
};

export const setPin = async (nameKey: string, pin: string): Promise<void> => {
  const salt = randomSalt();
  const pin_hash = await hashPin(salt, pin);
  const existing = await getPinRecord(nameKey);
  try {
    if (existing) {
      await pb.collection(COLLECTION).update(existing.id, { salt, pin_hash });
    } else {
      await pb.collection(COLLECTION).create({ name_key: nameKey, salt, pin_hash });
    }
  } catch (e) {
    throw asWriteError(e);
  }
};

export const clearPin = async (nameKey: string): Promise<void> => {
  const existing = await getPinRecord(nameKey);
  if (!existing) return;
  try {
    await pb.collection(COLLECTION).delete(existing.id);
  } catch (e) {
    throw asWriteError(e);
  }
};

export const PIN_LENGTH = 4;
export const isValidPin = (v: string): boolean =>
  new RegExp(`^\\d{${PIN_LENGTH}}$`).test(v);
