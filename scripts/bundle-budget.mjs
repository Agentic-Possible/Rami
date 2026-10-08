import { readdir, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { readFile } from 'node:fs/promises'
let total = 0
for (const name of await readdir('dist/assets')) {
  if (!name.endsWith('.js')) continue
  const path = `dist/assets/${name}`
  const size = (await stat(path)).size
  total += size
  if (size > 450_000) throw new Error(`Chunk ${name} exceeds 450 kB`)
  console.log(`${name}: ${size} bytes, ${gzipSync(await readFile(path)).length} gzip bytes`)
}
if (total > 1_200_000) throw new Error('Total JavaScript exceeds 1.2 MB')
console.log(`Bundle budget passed: ${total} bytes`)
