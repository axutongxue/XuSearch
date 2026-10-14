


export const DISMISS_SILENCE_MS = 7 * 24 * 60 * 60 * 1000;


export function inDismissSilence(dismissedAt, now = Date.now()) {
  const at = Number(dismissedAt);
  return Number.isFinite(at) && at > 0 && now - at < DISMISS_SILENCE_MS;
}
