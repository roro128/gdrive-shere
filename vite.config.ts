import { cloudflare } from '@cloudflare/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [tailwindcss(), cloudflare({ viteEnvironment: { name: 'ssr' } }), reactRouter()],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
