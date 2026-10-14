
const chains = new Map();

export function withStorageLock(lockKey, fn) {
  const key = String(lockKey || "default");
  const prev = chains.get(key) || Promise.resolve();
  const run = prev.then(() => fn());
  chains.set(key, run.catch(() => {}));
  return run;
}
