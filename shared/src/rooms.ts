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

export const openDmSchema = z.union([
  z.object({ userId: z.string().min(1).max(80) }),
  z.object({
    username: z
      .string()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9_]+$/),
  }),
]);

export const peopleQuerySchema = z.object({
  q: z.string().max(64).optional(),
});

export const attachmentInputSchema = z.object({
  name: z.string().min(1).max(240),
  mime: z.string().min(3).max(180),
  data: z.string().min(8).max(8_000_000),
});

export const postMessageSchema = z
  .object({
    clientMessageId: z.string().min(8).max(80),
    body: z.string().max(4000).default(""),
    createdAt: z.string().min(1).optional(),
    attachment: attachmentInputSchema.optional(),
  })
  .refine((value) => value.body.trim().length > 0 || Boolean(value.attachment), {
    message: "Message needs text or a file",
  });

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type OpenDmInput = z.infer<typeof openDmSchema>;
export type PeopleQuery = z.infer<typeof peopleQuerySchema>;
export type PostMessageInput = z.infer<typeof postMessageSchema>;
export type AttachmentInput = z.infer<typeof attachmentInputSchema>;

