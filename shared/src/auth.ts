import { z } from "zod";

export const signupSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(64),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  username: z.string().min(1).max(32),
  password: z.string().min(1).max(128),
});

export const updateProfileSchema = z
  .object({
    displayName: z.string().min(1).max(64).optional(),
    avatarUrl: z
      .string()
      .max(120_000)
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
      .nullable()
      .optional(),
  })
  .refine(
    (value) => value.displayName !== undefined || value.avatarUrl !== undefined,
    { message: "Nothing to update" },
  );

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
