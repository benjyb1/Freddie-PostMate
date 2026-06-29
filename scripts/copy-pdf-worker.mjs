// Copy the pdf.js worker out of node_modules into /public so the postcard design
// editor can load it from our own origin instead of a third-party CDN. Runs on
// dev + build (see package.json), so it always matches the installed pdfjs-dist
// version — no manual sync, no stale-worker version mismatch.
import { copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const src = join(dirname(require.resolve('pdfjs-dist/package.json')), 'build/pdf.worker.min.mjs')
copyFileSync(src, 'public/pdf.worker.min.mjs')
console.log('copied pdf.js worker -> public/pdf.worker.min.mjs')
