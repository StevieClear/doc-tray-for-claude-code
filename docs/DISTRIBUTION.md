# Distribution decision

**Recommendation: (a) a native plugin installed from this repo's marketplace.** That is how v1 ships.

| | (a) Native plugin + marketplace | (b) SDK / library | (c) Skill or CLAUDE.md snippet + script |
|---|---|---|---|
| **Reach** | Every Claude Code terminal and desktop user; listable in plugin directories and awesome-lists | Only people building their own agents on the SDK; not the target audience | Anyone, but it reads as a tip, not a tool |
| **Install friction** | One line: `/plugin install doc-tray --marketplace StevieClear/doc-tray-for-claude-code`, then `y` and Enter | npm install plus code to wire it into a host | Copy a file, edit settings, add a hook script by hand; easy to get wrong |
| **What it can do** | A live clickable band above the prompt, hotkeys, toasts, `/tray` commands, per-project store | No UI inside Claude Code | No band: a settings hook can log paths, but nothing clickable; burns tokens if the model is asked to list files |
| **Maintenance** | One repo; the plugin API is early access and may change between releases, so CI runs `validate`, `test` and `tsc` on every push | A second package and API to version | Breaks silently with settings or shell differences across macOS / Linux / Windows |
| **Cost** | Free; no model calls | Free | Small token cost each time the model is asked |

## Why not (b) or (c)

- (b) solves a different problem: the audience is Claude Code users, not agent builders.
- (c) cannot draw the tray, and the spec's audience quits after one error. A hand-edited hook script is where that error happens.

## Risk and mitigation

The function-hooks API is early access. Pin behaviour with tests (`hooks/tray.test.ts`), run CI against the latest Claude Code on every push, and tag releases (`v0.1.0`, ...) so users can stay on a known-good version.
