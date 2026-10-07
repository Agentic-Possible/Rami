import { readFile } from 'node:fs/promises'
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
for (const file of ['AGENTS.md', 'README.md', '.claude/skills/marginalia-dev/SKILL.md']) {
  const text = await readFile(file, 'utf8')
  for (const [, command] of text.matchAll(/npm run ([\w:-]+)/g)) {
    if (!(command in pkg.scripts)) throw new Error(`${file}: undocumented script ${command}`)
  }
}
const agents = await readFile('AGENTS.md', 'utf8')
for (const section of [
  'Applications and boundaries',
  'Setup and commands',
  'Interactive QA',
  'Conventions',
  'Privacy and safety',
]) {
  if (!agents.includes(`## ${section}`)) throw new Error(`Missing AGENTS section: ${section}`)
}
if (/four pre-existing|four.*warnings/.test(agents)) throw new Error('Stale lint guidance')
console.log('Agent command documentation matches package scripts')
