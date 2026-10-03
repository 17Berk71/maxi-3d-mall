import {defineConfig} from 'vite';

export default defineConfig({
  base: './', // пути относительные: сайт работает и в корне домена, и во вложенной папке
  server: {port: 5173, open: true},
  build: {target: 'es2020', chunkSizeWarningLimit: 2000}
});
