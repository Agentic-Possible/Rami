-- Context extraction kept separate from question/dialog orchestration.
local CONTEXT_WORDS = 80
local Context = {}

-- KOReader's helper handles crengine's selection-clearing behavior.
function Context.around(highlight, text)
    local ok, before, after = pcall(function()
        return highlight:getSelectedWordContext(CONTEXT_WORDS)
    end)
    if not ok then
        return nil
    end

    local parts = {}
    for _, part in ipairs({ before, text, after }) do
        if type(part) == "string" then
            local clean = part:gsub("%s+", " "):gsub("^ ", ""):gsub(" $", "")
            if clean ~= "" then
                table.insert(parts, clean)
            end
        end
    end
    if #parts <= 1 then
        return nil
    end
    return table.concat(parts, " ")
end

function Context.metadata(props)
    props = props or {}
    return {
        title = props.display_title or props.title,
        authors = props.authors,
        language = props.language,
        description = props.description,
    }
end

return Context
