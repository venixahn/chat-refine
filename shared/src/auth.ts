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

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
