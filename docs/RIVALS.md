# Doc Tray vs other ways to find files Claude Code wrote

Surveyed October 2026. "How do I see the files Claude Code created?" has a few answers today; this is how they compare.

| Tool | What it is | Does better | Doc Tray does better |
|---|---|---|---|
| **Claude Code `/artifacts`** (built in) | A panel of published claude.ai artifacts (web pages), with o open, c copy link, d delete, / search | Search, sharing links, and a full keyboard panel | Local files on disk: reports, `.xlsx`, `.pdf`, `.docx`. `/artifacts` lists hosted pages, not files the session wrote |
| **Codey** (Claude Code plugin) | A timeline of past sessions and every step Claude took, with token costs | History across sessions, step-by-step replay | One-click open/reveal of the output itself; always visible above the prompt; no timeline to dig through |
| **Claude Sessions** (Obsidian plugin) | Reads Claude Code session JSONL files into Obsidian notes | Full-text search and linking inside a notes vault | Lives in Claude Code, no second app; opens the file in its own app |
| **Aider `/diff`, git log** | Every AI change is a git commit; `/diff` shows it | Exact diffs, undo, works for code | Non-code docs that are often untracked or git-ignored; version dedupe by filename |
| **OpenCode file tree** | An IDE-like TUI with a file tree beside the chat | Browsing the whole project | Shows only what the session produced, newest version only, three rows, no browsing |
| **Asking Claude "list the files you made"** | A prompt | Zero install | Costs no tokens, survives compaction and new sessions, and is clickable |

## Features worth adopting (post-v1)

1. **Search / filter (`/tray find <text>`)**, from `/artifacts`. Useful once a project nears the 50-entry cap.
2. **Copy path (`c` hotkey)**, from `/artifacts`' copy-link key. Claude Code's `$.ui.copy` makes this cheap.
3. **Cross-session history view**, a lighter take on Codey: a `/tray history` pane listing pruned older versions, read-only.

## Sources

- [Claude Code artifacts docs](https://code.claude.com/docs/en/artifacts)
- [Codey](https://github.com/SeanPash/Codey)
- [Claude Sessions for Obsidian](https://www.obsidianstats.com/plugins/claude-sessions)
- [Aider guide](https://deployhq.com/guides/aider)
- [AI coding CLI overview (OpenCode)](https://ubuntu.fan/en/docs/ai/ai-coding-cli)
