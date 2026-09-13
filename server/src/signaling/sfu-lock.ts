export type Exclusive = (work: () => Promise<void>) => Promise<void>;

export const createExclusive = (): Exclusive => {
  let tail: Promise<void> = Promise.resolve();
  return (work) => {
    const run = tail.then(work, work);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
};
