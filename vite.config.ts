import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';

const LAST_COMMIT_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function resolveLastCommitTimestamp(): string {
  let timestamp: string;
  try {
    timestamp = execFileSync(
      'git',
      ['log', '-1', '--format=%cd', '--date=format-local:%Y-%m-%d %H:%M:%S'],
      { cwd: import.meta.dirname, encoding: 'utf8' },
    ).trim();
  } catch (error) {
    throw new Error('Could not read the latest Git commit timestamp for the About panel.', { cause: error });
  }

  if (!LAST_COMMIT_TIMESTAMP_PATTERN.test(timestamp)) {
    throw new Error(`Git returned an invalid latest commit timestamp: ${JSON.stringify(timestamp)}.`);
  }
  return timestamp;
}

const lastCommitTimestamp = resolveLastCommitTimestamp();

export default defineConfig({
  base: './',
  define: {
    __CACABLU_LAST_COMMIT_AT__: JSON.stringify(lastCommitTimestamp),
  },
  server: {
    port: 5173,
  },
  optimizeDeps: {
    include: ['sql.js'],
  },
  assetsInclude: ['**/*.wasm'],
});
