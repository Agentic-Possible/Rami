/**
 * Runs the plugin's pure Lua modules under a Lua VM, so the parts of this
 * feature that live in Lua are not tested only by hand on a Kindle.
 *
 * Only the modules that `require` nothing from KOReader can run here, which is
 * why `marginalia_prompt.lua` and `marginalia_payload.lua` were written that
 * way: the prompt's injection fence and the export's identity scheme are
 * exactly the parts where a quiet mistake is expensive and a device is a bad
 * place to look for one. `marginalia_tls.lua` joins them with a stub for
 * LuaSocket, since its hostname matching is pure once the module has loaded.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LuaFactory } from 'wasmoon'

const here = dirname(fileURLToPath(import.meta.url))
const pluginDir = join(here, '..', 'marginalia.koplugin')

/** Loaded in dependency order; each is put into `package.loaded` under its name. */
const MODULES = [
  'marginalia_prompt',
  'marginalia_payload',
  'marginalia_tls',
  'marginalia_view',
  'marginalia_digest',
  'marginalia_memory',
]

/**
 * Stands in for the KOReader modules the pure files touch.
 *
 * `socket.try` is the only one with behavior that matters: LuaSocket's version
 * raises so that `socket.protect` around `http.request` can turn the failure
 * back into `nil, message`, and the TLS module relies on that.
 */
const STUBS = `
package.loaded["logger"] = setmetatable({}, { __index = function() return function() end end })
package.loaded["socket"] = {
  try = function(ok, err) if not ok then error(err, 0) end end,
}
package.loaded["gettext"] = function(text) return text end
package.loaded["ui/trapper"] = {}

-- marginalia_memory pulls these in for the half of it that talks to a device.
-- The half under test here is arithmetic over a threads table and touches none
-- of them, so they only have to exist.
package.loaded["marginalia_relay"] = {}
package.loaded["marginalia_store"] = {}
package.loaded["marginalia_util"] = {}
`

const factory = new LuaFactory()

function luaLiteral(source: string): string {
  let equals = '='
  while (source.includes(`]${equals}]`)) equals += '='
  return `[${equals}[${source}]${equals}]`
}

/** Each scenario gets its own VM, and it is freed even when an assertion fails. */
export async function withLua<T>(
  bootstrap: string,
  modules: string[],
  run: (evaluate: (source: string) => unknown) => T,
): Promise<T> {
  const engine = await factory.createEngine({ functionTimeout: 5_000 })
  try {
    const evaluate = (source: string): unknown => engine.doStringSync(source)
    evaluate(bootstrap)
    for (const name of modules) {
      const directory = name === 'spec_helper' ? here : pluginDir
      const source = readFileSync(join(directory, `${name}.lua`), 'utf8')
      evaluate(`package.loaded[${JSON.stringify(name)}] = assert(load(
        ${luaLiteral(source)}, ${JSON.stringify(`@${name}.lua`)}
      ))()`)
    }
    return run(evaluate)
  } finally {
    engine.global.close()
  }
}

/**
 * Runs one `.lua` spec and returns whatever it printed.
 *
 * A spec reports a failure by calling `error`, which surfaces here as a thrown
 * exception carrying the Lua message and line — so a broken assertion reads
 * like any other test failure rather than a silent zero.
 */
export async function runSpec(name: string): Promise<string> {
  const printed: string[] = []
  const engine = await factory.createEngine({ functionTimeout: 5_000 })
  try {
    engine.global.set('recordPrint', (...parts: unknown[]) =>
      printed.push(parts.map(String).join('\t')),
    )
    engine.doStringSync(`print = recordPrint\n${STUBS}`)
    for (const module of [...MODULES, 'spec_helper']) {
      const directory = module === 'spec_helper' ? here : pluginDir
      const source = readFileSync(join(directory, `${module}.lua`), 'utf8')
      engine.doStringSync(`package.loaded[${JSON.stringify(module)}] = assert(load(
        ${luaLiteral(source)}, ${JSON.stringify(`@${module}.lua`)}
      ))()`)
    }
    engine.doStringSync(readFileSync(join(here, `${name}.lua`), 'utf8'))
    return printed.join('\n')
  } finally {
    engine.global.close()
  }
}
