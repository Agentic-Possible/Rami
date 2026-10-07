import { describe, expect, it } from 'vitest'
import { withLua } from './harness.ts'

describe('KOReader context extraction', () => {
  it.each([
    [
      'joins and normalizes surrounding prose',
      `
      local Context = require("marginalia_context")
      local highlight = { getSelectedWordContext = function(_, words)
        assert(words == 80)
        return "  before\\n", " after  "
      end }
      return Context.around(highlight, " passage ") == "before passage after"
    `,
    ],
    [
      'fails safely when the host cannot extract context',
      `
      local Context = require("marginalia_context")
      local highlight = { getSelectedWordContext = function() error("unavailable") end }
      return Context.around(highlight, "passage") == nil
    `,
    ],
    [
      'does not claim surrounding context for only the passage',
      `
      local Context = require("marginalia_context")
      local highlight = { getSelectedWordContext = function() return "", "" end }
      return Context.around(highlight, "passage") == nil
    `,
    ],
    [
      'prefers display metadata and handles missing properties',
      `
      local Context = require("marginalia_context")
      local book = Context.metadata({display_title="Display", title="Fallback", authors="Test"})
      return book.title == "Display" and book.authors == "Test"
        and Context.metadata(nil).title == nil
    `,
    ],
  ])('%s', async (_label, source) => {
    const result = await withLua('', ['marginalia_context'], (evaluate) => evaluate(source))
    expect(result).toBe(true)
  })
})
