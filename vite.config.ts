import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente
  loadEnv(mode, process.cwd(), '')

  return {
    // IMPORTANTE para Vercel / GitHub
    base: './',

    plugins: [react()],

    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  }
})
