// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://stankarz.github.io',
  trailingSlash: 'always',
  integrations: [sitemap(), mdx(), preact()],
  // PGlite ships its own wasm and loads it itself; Vite's dependency pre-bundling breaks that in dev.
  vite: { optimizeDeps: { exclude: ['@electric-sql/pglite'] } },
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    // Colours come from --astro-code-* tokens in prose.css, so code follows the theme toggle.
    shikiConfig: { theme: 'css-variables' },
  },
});
