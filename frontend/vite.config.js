import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envDir = path.resolve(__dirname, '..')
const firebaseMessagingSwFile = 'firebase-messaging-sw.js'

function getFirebaseApiKey(mode) {
  const env = loadEnv(mode, envDir, '')
  return env.VITE_FIREBASE_API_KEY || env.REACT_APP_FIREBASE_API_KEY || ''
}

function injectFirebaseApiKey(source, apiKey) {
  return source.replaceAll('__FIREBASE_API_KEY__', apiKey)
}

function firebaseMessagingSwEnvPlugin(mode) {
  const firebaseApiKey = getFirebaseApiKey(mode)

  return {
    name: 'availo-firebase-messaging-sw-env',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (url.pathname !== `/${firebaseMessagingSwFile}`) {
          next()
          return
        }

        const source = await fs.promises.readFile(
          path.resolve(__dirname, 'public', firebaseMessagingSwFile),
          'utf8',
        )

        res.setHeader('Content-Type', 'application/javascript')
        res.end(injectFirebaseApiKey(source, firebaseApiKey))
      })
    },
    async writeBundle(outputOptions) {
      const outDir = outputOptions.dir
        ? path.resolve(__dirname, outputOptions.dir)
        : path.resolve(__dirname, 'dist')
      const swPath = path.resolve(outDir, firebaseMessagingSwFile)

      if (!fs.existsSync(swPath)) return

      const source = await fs.promises.readFile(swPath, 'utf8')
      await fs.promises.writeFile(
        swPath,
        injectFirebaseApiKey(source, firebaseApiKey),
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  envDir,
  envPrefix: ['VITE_', 'REACT_APP_'],
  plugins: [react(), firebaseMessagingSwEnvPlugin(mode)],
}))