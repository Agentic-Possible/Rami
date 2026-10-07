import { readFile } from 'node:fs/promises'
const registry = JSON.parse(await readFile('config/feature-flags.json', 'utf8'))
const example = await readFile('.env.example', 'utf8')
for (const [flag, details] of Object.entries(registry)) {
  if (!details.purpose || !details.owners.length || !details.consumers.length)
    throw new Error(`${flag}: incomplete ownership or purpose`)
  if (!example.includes(`${flag}=`)) throw new Error(`${flag}: missing configuration example`)
  for (const file of details.consumers) {
    const source = await readFile(file, 'utf8')
    if (!source.includes(flag)) throw new Error(`${flag}: stale consumer ${file}`)
  }
}
console.log('Owned feature flags have live consumers and configuration examples')
