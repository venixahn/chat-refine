const mediaExceptionHint = (name: string): string | null => {
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Allow camera and microphone for this site.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone or camera is available.";
  }
  return null;
};

export const callMediaError = (error?: unknown): string => {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return "Camera and mic need http://127.0.0.1 or HTTPS — not a LAN hostname over HTTP.";
  }
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "This browser cannot access camera or microphone.";
  }
  const name = error instanceof DOMException ? error.name : "";
  return mediaExceptionHint(name) ?? "Could not access microphone or camera";
};

export const captureLocal = async (): Promise<MediaStream> => {
  const gum = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  if (!gum) {
    throw new Error(callMediaError());
  }
  try {
    return await gum({ audio: true, video: true });
  } catch {
    try {
      return await gum({ audio: true, video: false });
    } catch (error) {
      throw new Error(callMediaError(error));
    }
  }
};
