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

export const userPreferencesSchema = z.object({
  theme: z.enum(["dark", "light", "system"]),
  visibility: z.enum(["everyone", "contacts", "hidden"]),
  showOnline: z.boolean(),
});

export const defaultPreferences = (): UserPreferences => ({
  theme: "dark",
  visibility: "everyone",
  showOnline: true,
});

const catalogAvatar = z
  .string()
  .regex(/^\/avatars\/[a-z0-9-]+\.svg$/);

const uploadedAvatar = z
  .string()
  .max(200_000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/);

export const updateProfileSchema = z
  .object({
    displayName: z.string().min(1).max(64).optional(),
    avatarUrl: z
      .union([catalogAvatar, uploadedAvatar, z.null()])
      .optional(),
    bio: z.string().max(280).optional(),
    status: z.string().max(80).optional(),
    preferences: userPreferencesSchema.partial().optional(),
  })
  .refine(
    (value) =>
      value.displayName !== undefined ||
      value.avatarUrl !== undefined ||
      value.bio !== undefined ||
      value.status !== undefined ||
      value.preferences !== undefined,
    { message: "Nothing to update" },
  );

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
