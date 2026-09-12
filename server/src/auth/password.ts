import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Effect } from "effect";

const scrypt = promisify(scryptCb);

export class CryptoFailure {
  readonly _tag = "CryptoFailure";
  constructor(readonly message: string) {}
}

export const hashPassword = (password: string) =>
  Effect.tryPromise({
    try: async () => {
      const salt = randomBytes(16).toString("hex");
      const derived = (await scrypt(password, salt, 64)) as Buffer;
      return `${salt}:${derived.toString("hex")}`;
    },
    catch: (error) => new CryptoFailure(String(error)),
  });

export const verifyPassword = (password: string, stored: string) =>
  Effect.tryPromise({
    try: async () => {
      const [salt, hash] = stored.split(":");
      if (!salt || !hash) {
        return false;
      }
      const derived = (await scrypt(password, salt, 64)) as Buffer;
      const expected = Buffer.from(hash, "hex");
      if (derived.length !== expected.length) {
        return false;
      }
      return timingSafeEqual(derived, expected);
    },
    catch: (error) => new CryptoFailure(String(error)),
  });
