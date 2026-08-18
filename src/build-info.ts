export const LAST_COMMIT_AT = __CACABLU_LAST_COMMIT_AT__;

export const LAST_COMMIT_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

if (!LAST_COMMIT_TIMESTAMP_PATTERN.test(LAST_COMMIT_AT)) {
  throw new Error(`Invalid embedded Git commit timestamp: ${JSON.stringify(LAST_COMMIT_AT)}.`);
}
