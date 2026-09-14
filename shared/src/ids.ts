const fillBytes = (bytes: Uint8Array): Uint8Array => {
  const web = globalThis.crypto;
  if (typeof web?.getRandomValues === "function") {
    web.getRandomValues(bytes);
    return bytes;
  }
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

const uuidFromBytes = (bytes: Uint8Array): string => {
  const copy = new Uint8Array(bytes);
  copy[6] = ((copy[6] ?? 0) & 0x0f) | 0x40;
  copy[8] = ((copy[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...copy].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const newId = (): string => {
  const web = globalThis.crypto;
  if (typeof web?.randomUUID === "function") {
    return web.randomUUID();
  }
  return uuidFromBytes(fillBytes(new Uint8Array(16)));
};
