import type { PublicProfile } from "../db/schema.ts";

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends PublicProfile {}
  }
}

export {};
