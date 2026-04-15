import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(rootDir, '..', 'dist');
const htmlPath = join(distDir, 'index.html');

const html = await readFile(htmlPath, 'utf8');

const scriptMatch = html.match(
  /<script type="module" crossorigin src="([^"]+)"><\/script>/,
);
const styleMatch = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);

if (!scriptMatch) {
  throw new Error('No module script asset was found in dist/index.html.');
}

const scriptPath = join(distDir, scriptMatch[1].replace(/^\.\//, ''));
const scriptSource = (await readFile(scriptPath, 'utf8')).replace(/<\/script>/g, '<\\/script>');

let styleBlock = '';

if (styleMatch) {
  const stylePath = join(distDir, styleMatch[1].replace(/^\.\//, ''));
  const styleSource = await readFile(stylePath, 'utf8');
  styleBlock = `<style>${styleSource}</style>`;
}

let nextHtml = html
  .replace(styleMatch?.[0] ?? '', '')
  .replace(scriptMatch[0], `<script type="module">${scriptSource}</script>`);

if (styleBlock) {
  nextHtml = nextHtml.replace('</head>', `${styleBlock}</head>`);
}

await writeFile(htmlPath, nextHtml, 'utf8');
