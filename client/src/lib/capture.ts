const mediaExceptionHint = (name: string): string | null => {
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Allow camera and microphone for this site.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone or camera is available.";
  }
  if (name === "SecurityError") {
    return "Camera and mic need HTTPS. Open https://127.0.0.1:5173 and accept the certificate.";
  }
  return null;
};

export const callMediaError = (error?: unknown): string => {
  const name = error instanceof DOMException ? error.name : "";
  const hint = mediaExceptionHint(name);
  if (hint) {
    return hint;
  }
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "Camera and mic need HTTPS. Open https://127.0.0.1:5173 and accept the certificate.";
  }
  return "Could not access microphone or camera";
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
