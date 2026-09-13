import { z } from "zod";

const iceUrlSchema = z
  .string()
  .min(1)
  .refine((url) => /^(stun|stuns|turn|turns):/i.test(url));

export const iceServerSchema = z.object({
  urls: z.union([iceUrlSchema, z.array(iceUrlSchema).min(1)]),
  username: z.string().min(1).optional(),
  credential: z.string().min(1).optional(),
});

export const iceServersSchema = z.array(iceServerSchema);

export const iceConfigSchema = z.object({
  iceServers: iceServersSchema,
});

export type IceServer = z.infer<typeof iceServerSchema>;

/** Public Google STUN. Used when ICE_SERVERS is unset so peers can cross NATs. */
export const DEFAULT_ICE_SERVERS: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

export const parseIceServers = (raw: string | undefined): IceServer[] => {
  if (!raw?.trim()) {
    return DEFAULT_ICE_SERVERS;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
  if (!Array.isArray(value)) {
    return DEFAULT_ICE_SERVERS;
  }
  const servers: IceServer[] = [];
  for (const item of value) {
    const parsed = iceServerSchema.safeParse(item);
    if (parsed.success) {
      servers.push(parsed.data);
    }
  }
  return servers;
};
