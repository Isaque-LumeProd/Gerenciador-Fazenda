import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { apiLocal } from './server/vite-api-local';
import { CABECALHOS_SEGURANCA } from './shared/cabecalhos';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // `--mode servidor-local`: serve a API com banco embutido, sem precisar do Netlify.
    mode === 'servidor-local' && apiLocal(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Fazenda Ativa',
        short_name: 'Fazenda Ativa',
        description: 'Gestão de gado, aves, sanidade, estoque e financeiro da fazenda.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#1f3a22',
        theme_color: '#1f3a22',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // O app inteiro fica guardado no aparelho e abre sem internet.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        // A API nunca passa pelo cache: dados sempre vêm do servidor (ou do armazenamento local do app).
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // A versão de produção local usa os mesmos cabeçalhos de segurança do Netlify (para testar a CSP).
  preview: { headers: CABECALHOS_SEGURANCA },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          graficos: ['recharts'],
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
}));
