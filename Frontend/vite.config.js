import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env files so we can read VITE_DEV_BACKEND_URL in the Node/proxy context
  const env = loadEnv(mode, process.cwd(), '')

  // Where the backend is running.
  // Dev default: read from .env.development VITE_DEV_BACKEND_URL
  // Production build: proxy is irrelevant (FastAPI serves the built files directly)
  const backendTarget = env.VITE_DEV_BACKEND_URL || 'http://127.0.0.1:5000'

  return {
    plugins: [
      react(),
      basicSsl(),  // enables HTTPS with self-signed cert → allows geolocation on non-localhost
    ],

    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },

    resolve: {
      alias: {
        'react':     path.resolve('./node_modules/react'),
        'react-dom': path.resolve('./node_modules/react-dom'),
      },
      dedupe: ['react', 'react-dom'],
    },

    server: {
      // Allow connections from any machine on the network (not just localhost)
      host: '0.0.0.0',
      port: 8080,
      // Avoid Vite restarts when Cargo writes into src-tauri/target/
      watch: { ignored: ['**/src-tauri/**'] },

      proxy: {
        // All API calls → backend
        '/v1': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error',    (err, req)      => console.error('[proxy error]', req.url, err.message))
            proxy.on('proxyReq', (_pr, req)      => console.log  ('[→ backend]',  req.method, req.url))
            proxy.on('proxyRes', (res, req)      => console.log  ('[← backend]',  res.statusCode, req.url))
          },
        },
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/stitching': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
