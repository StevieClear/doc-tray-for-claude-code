# doc-tray: build spec

A Claude Code plugin that adds a small tray above the prompt listing the documents the session has written (reports, handoffs, outlines, exports). Each one is a click away from opening or being revealed in the file manager. This file is the reference for building it.

## 1. What it does

```
Tray  [ HANDOFF-2026-10-06-2029 ]  [ Reveal ]  [ x ]
      [ MARKET-REPORT-2026-10-06.html ]  [ Reveal ]  [ x ]
      [ build-notes ]  [ Reveal ]  [ x ]
      [ ^ ]  [ v ]  4-6 of 9
```

- **One row per doc:** `[name]` opens it, `[Reveal]` shows it in Finder / Explorer / the file manager, and `[x]` takes it off the tray. Removing a doc never touches the file.
- **Auto-capture:** hook the file-writing tool calls (Write, Edit, NotebookEdit, plus any others the types list). A successful write to a doc extension adds that file to the tray.
  - Default extensions: `.md .html .pdf .xlsx .csv .docx .pptx`. Make the list configurable through `userConfig` if the build supports it.
- **Manual control:** `/tray` toggles the tray. The full command set is `/tray on | off | toggle | add <path> | remove <path> | clear | list`.

## 2. Version control (newest wins)

Docs that are versions of the same document form a **chain**, and only the newest one in a chain is shown (by file mtime).

| Chain key | Rule |
|---|---|
| `HANDOFF` | Any filename that starts with `HANDOFF`, case-insensitive |
| `OUTLINE` | Any filename that contains `OUTLINE`, case-insensitive |
| `V:<stem>.<ext>` | The filename with `YYYY-MM-DD`, standalone 4-digit times (`-HHMM-`) and a trailing `-vN` / `-vN.N` stripped. It only counts as a chain if something was actually stripped and a stem remains. The extension is kept, so `X.md` and `X.html` stay separate. |
| none | Any other doc. It never supersedes anything. |

- Adding or capturing a doc prunes the older versions in its chain from storage.
- `[x]` on a versioned doc hides the **whole chain**, so an older version can't come back. Adding the doc again unhides it.
- Display is deduplicated, keeps each doc's place in the list, and shows only the newest member of each chain.

Reference cases:

```
HANDOFF-2026-10-06-1800-director.md  -> HANDOFF
MASTER-EXECUTION-OUTLINE-2026-10-05.md -> OUTLINE
MARKET-REPORT-2026-10-06.html        -> V:MARKET-REPORT.html
DELL-CLEAR-LIST-2026-10-06.md        -> V:DELL-CLEAR-LIST.md
NOTES.md                             -> none
```

## 3. Scrolling: more than 3 docs

- The tray shows at most 3 rows at once.
- With more than 3 docs, it adds clickable `[ ^ ]` `[ v ]` controls and a position readout (`4-6 of 9`).
- **Keyboard access is required:**
  - Arrow keys (or a registered keybinding) move the window.
  - Enter opens the focused row.
  - A key removes the focused row.
- If the above-prompt band can't take focus in this build, use the closest mechanism the build does support: registered keybindings, `/tray next | prev | open N | remove N`, or a Pane opened from the band. Document the limitation in the README.

## 4. Platform

| OS | Open | Reveal |
|---|---|---|
| macOS | `open <path>` | `open -R <path>` |
| Linux | `xdg-open <path>` | `xdg-open <dir>` |
| Windows | `explorer <path>` | `explorer /select,<path>` |

Detect the platform through the plugin API. If a command fails, show a toast; never throw.

## 5. Efficiency

- No polling. Refresh only on tool-call results, `session.start` and the plugin's own commands.
- No model calls and no telemetry.
- State lives in the plugin API: `$.store` across sessions, keyed by project/cwd, and `$.state` for the view, such as the scroll offset. No shell scripts and no external files outside the plugin's store.
- Cap stored history at about 50 entries per project.

## 6. Repo shape and distribution

- The repo is a **plugin marketplace**, so installing is one line:
  `/plugin install doc-tray --marketplace StevieClear/doc-tray`
- Layout:
  - `.claude-plugin/plugin.json` and `marketplace.json`
  - `hooks/hooks.json` and `hooks/register.tsx`
  - `types/index.d.ts` (the state contract)
  - `hooks/*.test.ts`
- Gates: `claude plugin validate`, `tsc -p .` and `claude plugin test` must all pass.
- Tests must cover: open, reveal, `[x]`, chain supersede, chain hide/unhide, scroll by click, scroll by keyboard, on/off, and auto-capture from a Write call.
- Do not put "Claude" or "Anthropic" in the plugin or repo name. "for Claude Code" in descriptions is fine.

## 7. After v1 works (not before)

1. **Rival review:** survey existing Claude Code / AI-CLI plugins and tools that surface session files, artifacts, recent docs or pins. Record what they do better and what this does better, then pick 1-3 features worth adopting. Write the findings to `docs/RIVALS.md`.
2. **Distribution decision:** compare (a) a native plugin with marketplace install, (b) an SDK/library, and (c) a prompt-plus-code drop-in such as a skill or CLAUDE.md snippet with a script. Judge on reach, install friction, maintenance and cost. Recommend one and record it in `docs/DISTRIBUTION.md`.
3. **README:** what it does, the ASCII tray, install, commands, keys, the chain rule, config, limitations, uninstall.

## 8. Findability (Google, GitHub search, AI answer engines)

People search for what they want ("claude code plugin", "see files claude code created", "claude code artifacts panel"), not for brand names. Capture those searches.

- **Repo slug:** `doc-tray-for-claude-code` (recommended rename; GitHub redirects the old URL). "for Claude Code" is the nominative form: it names the host app without implying an Anthropic product. Display name: **Doc Tray**.
- **Description (also the Google snippet):** "Doc Tray for Claude Code: a clickable tray of every file your session writes. Open, reveal, scroll, and auto-dedupe versions."
- **Topics (GitHub ranks on these):** claude-code, claude-code-plugin, claude-code-plugins, ai-coding, ai-agents, developer-tools, terminal, cli, productivity, file-manager.
- **README for humans and AI crawlers:**
  - Line 1 answers "what is it" in one sentence, using the words people search for.
  - Next: a GIF or screenshot, then install in one line.
  - Add a **FAQ** written as real questions ("How do I see the files Claude Code created?", "How do I open Claude Code output in Finder?"). Google, Perplexity and Claude-style answer engines pull exact Q&A pairs.
- **`llms.txt`** at repo root: a plain summary, install line and command list, so AI crawlers get the facts straight.
- **Social preview image** set in repo settings (1280x640) for link previews.
- **Distribution:**
  - Submit to the official plugin marketplace/directory if one accepts submissions.
  - Submit to the awesome-claude-code lists (PRs).
  - Post a short demo to r/ClaudeAI and Hacker News (Show HN), plus a Claude Code Discord/community share.
  - Write one blog post that targets the "see files claude code created" query and links to the repo.
- **Releases:** tag versions (v0.1.0 ...) with notes. Release pages get indexed, and stars plus recent activity drive GitHub search rank.

## 9. Rules

- MIT license. No personal paths, emails, tokens or private project names anywhere in the repo or its history.
