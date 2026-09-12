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

const iceUrlHost = (url: string): string | null => {
  const match = /^(?:stun|stuns|turn|turns):(\[[^\]]+\]|[^:?]+)(?::\d+)?/i.exec(
    url,
  );
  if (!match) {
    return null;
  }
  return match[1].replace(/^\[|\]$/g, "").toLowerCase();
};

const isCloudHost = (host: string): boolean =>
  host === "google.com" ||
  host.endsWith(".google.com") ||
  host === "twilio.com" ||
  host.endsWith(".twilio.com");

export const isCloudIceUrl = (url: string): boolean => {
  const host = iceUrlHost(url);
  return host !== null && isCloudHost(host);
};

const dropCloudUrls = (server: IceServer): IceServer | null => {
  const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
  const kept = urls.filter((url) => !isCloudIceUrl(url));
  if (kept.length === 0) {
    return null;
  }
  return {
    ...server,
    urls: Array.isArray(server.urls) ? kept : kept[0],
  };
};

export const parseIceServers = (raw: string | undefined): IceServer[] => {
  if (!raw?.trim()) {
    return [];
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const servers: IceServer[] = [];
  for (const item of value) {
    const parsed = iceServerSchema.safeParse(item);
    if (!parsed.success) {
      continue;
    }
    const cleaned = dropCloudUrls(parsed.data);
    if (cleaned) {
      servers.push(cleaned);
    }
  }
  return servers;
};
