import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Adresses du site : chaque page reçoit une copie de index.html, pour qu'un hébergement
// statique serve aussi les liens directs (/collection, /journal/…). 404.html sert le reste.
const ROUTES = ['collection', 'heritage', 'technologie', 'salons', 'partenaires', 'journal', 'a-propos', 'faq', 'contact', 'artiste'];

export default defineConfig({
  plugins: [{
    name: 'garo-routes',
    apply: 'build',
    closeBundle() {
      const out = resolve('dist');
      for (const r of ROUTES) { mkdirSync(resolve(out, r), { recursive: true }); copyFileSync(resolve(out, 'index.html'), resolve(out, r, 'index.html')); }
      copyFileSync(resolve(out, 'index.html'), resolve(out, '404.html'));
    },
  }],
});
