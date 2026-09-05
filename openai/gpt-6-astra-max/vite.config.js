import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', strictPort: true },
  build: {
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules\/three/ }] } },
    },
  },
});
