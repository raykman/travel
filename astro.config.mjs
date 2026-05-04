import { defineConfig } from 'astro/config';

// https://astro.build/config
// .env is auto-loaded by Astro/Vite into `import.meta.env`. Variables prefixed
// with `PUBLIC_` are exposed to client-side code automatically — no manual
// `vite.define` needed (and doing it manually breaks the built-in loading,
// because Astro puts .env values in import.meta.env, not process.env).
export default defineConfig({
  site: 'https://whereisray.com',
  devToolbar: {
    enabled: false,
  },
  vite: {
    // sharp is a native Node addon — exclude from Vite's bundler so it loads
    // correctly in both dev (SSR) and production build contexts.
    ssr: {
      external: ['sharp'],
    },
    optimizeDeps: {
      exclude: ['sharp'],
    },
  },
});
