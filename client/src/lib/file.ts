import { zipStore } from "@chat-refine/shared";

export const readAvatarDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      if (url.length > 200_000) {
        reject(new Error("Avatar is too large"));
        return;
      }
      resolve(url);
    };
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.readAsDataURL(file);
  });

const relativePath = (file: File): string =>
  (file.webkitRelativePath || file.name).replaceAll("\\", "/");

const isNested = (file: File): boolean => /[\\/]/.test(file.webkitRelativePath ?? "");

export const zipFolderFiles = async (files: File[]): Promise<File> => {
  const entries = await Promise.all(
    files.map(async (file) => ({
      name: relativePath(file),
      data: new Uint8Array(await file.arrayBuffer()),
    })),
  );
  const bytes = zipStore(entries);
  const root = entries[0]?.name.split("/")[0] ?? "folder";
  return new File([bytes], `${root}.zip`, { type: "application/zip" });
};

export const packAttachments = async (
  list: FileList | File[] | null,
): Promise<File | null> => {
  const files = list ? [...list] : [];
  const first = files[0];
  if (!first) {
    return null;
  }
  if (files.length === 1 && !isNested(first)) {
    return first;
  }
  return zipFolderFiles(files);
};
