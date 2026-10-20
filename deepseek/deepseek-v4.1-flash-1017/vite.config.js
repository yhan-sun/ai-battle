import { defineConfig } from 'vite';

// 相对 base，保证 GitHub Pages 子路径下静态资源可加载。
export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5176,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
});
