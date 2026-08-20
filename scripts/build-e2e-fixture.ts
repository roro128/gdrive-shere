import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { build } from 'vite';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = resolve(root, '.e2e-fixture');

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await build({
  configFile: false,
  mode: 'development',
  root,
  plugins: [tailwindcss()],
  define: {
    'import.meta.env.DEV': 'true',
    'import.meta.env.PROD': 'false'
  },
  build: {
    outDir: outputDir,
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(root, 'e2e/mock-workspace-app.tsx'),
      output: {
        entryFileNames: 'mock-workspace.js',
        assetFileNames: 'mock-workspace[extname]',
        format: 'iife'
      }
    }
  }
});

const fixtureHtml = [
  '<!doctype html>',
  '<html lang="ko">',
  '  <head>',
  '    <meta charset="UTF-8" />',
  '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
  '    <title>GShare mock workspace</title>',
  '    <link rel="stylesheet" href="./mock-workspace.css" />',
  '  </head>',
  '  <body>',
  '    <div id="root"></div>',
  '    <script src="./mock-workspace.js"></script>',
  '  </body>',
  '</html>'
].join('\n');

await writeFile(resolve(outputDir, 'mock-workspace.html'), fixtureHtml, 'utf8');
