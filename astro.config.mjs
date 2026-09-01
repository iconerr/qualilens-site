// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import searchIndex from './src/integrations/search-index.mjs';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://qualilens.org',
  integrations: [sitemap(), searchIndex()],
  vite: {
    plugins: [tailwindcss()]
  }
});
