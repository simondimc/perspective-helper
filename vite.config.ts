import { defineConfig } from 'vite';

// Na GitHub Pages je stran v podmapi repozitorija; lokalni razvoj ostane na /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/perspective-helper/' : '/',
}));
