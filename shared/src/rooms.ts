import { z } from "zod";

export const dmPairKey = (left: string, right: string): string =>
  [left, right].sort().join(":");

export const createGroupSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9 _-]+$/),
});

export const openDmSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/),
});

export const peopleQuerySchema = z.object({
  q: z.string().max(32).optional(),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type OpenDmInput = z.infer<typeof openDmSchema>;
export type PeopleQuery = z.infer<typeof peopleQuerySchema>;

