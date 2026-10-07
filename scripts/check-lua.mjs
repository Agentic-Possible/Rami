import { readdir, readFile } from 'node:fs/promises'
import { parse } from 'luaparse'

const allowed = new Set([
  '_G',
  'assert',
  'collectgarbage',
  'dofile',
  'error',
  'getmetatable',
  'ipairs',
  'load',
  'loadfile',
  'loadstring',
  'next',
  'pairs',
  'pcall',
  'print',
  'rawequal',
  'rawget',
  'rawset',
  'require',
  'select',
  'setmetatable',
  'tonumber',
  'tostring',
  'type',
  'unpack',
  'xpcall',
  'coroutine',
  'debug',
  'io',
  'math',
  'os',
  'package',
  'string',
  'table',
  'utf8',
  'jit',
  'bit',
  'G_reader_settings',
])
const directory = 'koreader/marginalia.koplugin'
let count = 0
function children(node) {
  return Object.entries(node)
    .filter(([key]) => key !== 'globals')
    .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
    .filter((value) => value && typeof value === 'object' && 'type' in value)
}
function complexity(node, root = true) {
  if (!root && node.type === 'FunctionDeclaration') return 0
  const branch = [
    'IfClause',
    'ElseifClause',
    'WhileStatement',
    'RepeatStatement',
    'ForNumericStatement',
    'ForGenericStatement',
  ].includes(node.type)
  const logical = node.type === 'LogicalExpression'
  return (
    Number(branch || logical) +
    children(node).reduce((sum, child) => sum + complexity(child, false), 0)
  )
}
function inspect(node, name) {
  if (node.type === 'FunctionDeclaration' && complexity(node) + 1 > 45)
    throw new Error(`${name}: Lua function exceeds complexity budget 45`)
  for (const child of children(node)) inspect(child, name)
}
for (const name of await readdir(directory)) {
  if (!name.endsWith('.lua')) continue
  const tree = parse(await readFile(`${directory}/${name}`, 'utf8'), {
    luaVersion: 'LuaJIT',
    scope: true,
    locations: true,
  })
  for (const global of tree.globals) {
    if (!allowed.has(global.name)) throw new Error(`${name}: undeclared global ${global.name}`)
  }
  inspect(tree, name)
  count++
}
console.log(`LuaJIT syntax, global, and complexity checks passed for ${count} modules`)
