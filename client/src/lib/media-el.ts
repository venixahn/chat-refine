export const bindSrcObject = (
  el: HTMLMediaElement | undefined,
  stream: MediaStream | null,
): void => {
  if (!el) {
    return;
  }
  el.srcObject = stream;
  if (stream) {
    void el.play().catch(() => undefined);
  }
};
