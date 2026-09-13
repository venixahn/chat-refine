export type FilePayload = {
  name: string;
  mime: string;
  data: string;
};

const MAX_FILE_CHARS = 1_400_000;

export const readFilePayload = (file: File): Promise<FilePayload> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      const data = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
      if (data.length < 8 || data.length > MAX_FILE_CHARS) {
        reject(new Error("File is too large (1 MB max)"));
        return;
      }
      resolve({
        name: file.name.slice(0, 180) || "file",
        mime: file.type || "application/octet-stream",
        data,
      });
    };
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });

export const readAvatarDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      if (url.length > 120_000) {
        reject(new Error("Avatar is too large"));
        return;
      }
      resolve(url);
    };
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.readAsDataURL(file);
  });
