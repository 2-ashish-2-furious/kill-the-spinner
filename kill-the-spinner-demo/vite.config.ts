import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"
import { caddyPlugin } from "./src/vite-plugin-caddy"

// Use aws-lambda preset for SST deployments (CI), otherwise use default for local dev
const nitroPreset = process.env.CI ? `aws-lambda` : undefined

const config = defineConfig({
  // `VITE_` is Vite's default. `DEMO_` is added so the conference-demo flags
  // (see src/lib/demo-flags.ts, e.g. DEMO_SLOW_ROLLBACK) can be read from the
  // client bundle under their documented names. Only DEMO_*/VITE_* vars are
  // exposed to the client; everything else in .env stays server-side.
  envPrefix: [`VITE_`, `DEMO_`],
  plugins: [
    devtools(),
    nitro({
      preset: nitroPreset,
      awsLambda: {
        streaming: true,
      },
    }),
    viteTsConfigPaths({
      projects: [`./tsconfig.json`],
    }),
    caddyPlugin(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  optimizeDeps: {
    // Keep the dep-optimizer away from the browser SQLite persistence package:
    // it ships a pre-built OPFS Web Worker (referenced via `new URL(...,
    // import.meta.url)`) that embeds the wa-sqlite WASM. Pre-bundling it via
    // esbuild breaks that worker/asset reference; excluding it lets Vite's
    // native worker + asset handling serve it as real ESM.
    exclude: [
      `@tanstack/start-server-core`,
      `@tanstack/browser-db-sqlite-persistence`,
      `@journeyapps/wa-sqlite`,
    ],
  },
  ssr: {
    noExternal: [`zod`, `drizzle-orm`],
  },
})

export default config
