
import { FEATURE_DEV_EXPORT } from "./features.js";

const PROD_BASE_URL = "https://xusearch.invalid";

export const BACKEND_BASE_URL = FEATURE_DEV_EXPORT ? "https://xusearch.invalid" : PROD_BASE_URL;

export const IS_LOCAL_BACKEND = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/.test(
  BACKEND_BASE_URL,
);

export const BACKEND_TIMEOUT_MS = 15000;
