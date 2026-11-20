import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const shared = JSON.parse(readFileSync(new URL('./shared/categories.json', import.meta.url), 'utf8'))
const zoneHomes = ['/cars', ...shared.categories.map(({ key }) => (key === shared.default ? '/' : `/${key}`))]

function preloadZoneHome() {
  return {
    name: 'preload-zone-home',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        const chunks = Object.values(bundle || {}).filter((item) => item.type === 'chunk')
        const home = chunks.find((chunk) => chunk.facadeModuleId?.endsWith('/src/pages/Home.jsx'))

        if (!home) {
          return html
        }

        const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
        const files = new Set()
        const visit = (chunk) => {
          if (!chunk || chunk.isEntry || files.has(chunk.fileName)) return
          files.add(chunk.fileName)
          chunk.viteMetadata?.importedCss?.forEach((css) => files.add(css))
          chunk.imports.forEach((name) => visit(byName.get(name)))
        }

        visit(home)

        const script = `(function(){var p=location.pathname.replace(/(.)\\/$/,"$1");if(${JSON.stringify(zoneHomes)}.indexOf(p)<0)return;${JSON.stringify([...files])}.forEach(function(f){var l=document.createElement("link"),css=/\\.css$/.test(f);l.rel=css?"preload":"modulepreload";if(css)l.as="style";l.href="/"+f;document.head.appendChild(l)})})()`

        return [{ tag: 'script', children: script, injectTo: 'head' }]
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preloadZoneHome()],
})
