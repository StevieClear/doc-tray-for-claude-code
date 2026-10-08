# Doc Tray for Claude Code

Doc Tray for Claude Code: a clickable tray of every file your session writes. Open, reveal, scroll, and auto-dedupe versions.

![Doc Tray demo](docs/demo.gif)

```
/plugin install doc-tray --marketplace StevieClear/doc-tray-for-claude-code
```

Answer `y` to add the marketplace, then press Enter to pick the user scope. The tray shows up the next time Claude Code writes a doc.

## What does it look like?

```
Tray  [ HANDOFF-2026-10-06-2029 ]  [ Reveal ]  [ x ]
      [ MARKET-REPORT-2026-10-06.html ]  [ Reveal ]  [ x ]
      [ build-notes ]  [ Reveal ]  [ x ]
      [ ^ ]  [ v ]  4-6 of 9
```

- Click a **name** to open the file in its default app.
- **Reveal** shows it in Finder, Explorer or your file manager.
- **x** takes it off the tray. The file itself is never touched.
- With more than 3 docs, **^** and **v** scroll the list.

## FAQ

### How do I see the files Claude Code created?

Install Doc Tray. Every time Claude Code writes or edits a document (`.md .html .pdf .xlsx .csv .docx .pptx`), the file appears in a tray above the prompt. Run `/tray list` to print the full list with paths.

### How do I open Claude Code output in Finder or Explorer?

Click **Reveal** next to the file in the tray, or run `/tray reveal N`, where N is the file's number in `/tray list`. macOS uses `open -R`, Windows uses `explorer /select,`, and Linux opens the containing folder with `xdg-open`.

### Why did an older version of my report disappear?

Doc Tray keeps only the newest version of a document. Files that differ only by a date (`2026-10-06`), a time (`-1800-`) or a version suffix (`-v2`, `-v2.1`) count as one document, and the newest by modified time wins. Any file starting with `HANDOFF` counts as one document, and so does any file containing `OUTLINE`. `report.md` and `report.html` stay separate.

### I removed a doc and it came back. Why?

It shouldn't. Pressing **x** on a versioned doc hides its whole version chain, so older versions can't return. Run `/tray add <path>` to bring it back on purpose.

### Can I use it with the keyboard?

Yes. Focus the tray first (click it, or press `ctrl+x` then `tab`). Then:

| Key | Does |
|---|---|
| `1` `2` `3` | Open row 1, 2 or 3 |
| `j` / `k` | Scroll down / up |
| `tab` then `enter` | Move to a button (name, Reveal or x) and press it |
| `esc` | Back to the prompt |

From the prompt, without focusing the tray: `/tray next`, `/tray prev`, `/tray open N`, `/tray reveal N`, `/tray remove N`.

### Which file types does it capture?

By default `.md .html .pdf .xlsx .csv .docx .pptx`. Change the list in `/config` under **doc-tray → Doc extensions** (space-separated, for example `.md .txt .json`).

### Does it slow Claude Code down, call a model or send data anywhere?

No. It never polls, makes no model calls and sends no telemetry. It updates only when a tool call finishes, when a session starts, or when you run `/tray`. Each project keeps up to 50 entries in Claude Code's plugin store.

### Is it free?

Yes, forever. MIT license, no paid tier, no upsell.

## Commands

| Command | Does |
|---|---|
| `/tray` or `/tray toggle` | Show or hide the tray |
| `/tray on` / `/tray off` | Show / hide the tray (remembered) |
| `/tray add <path>` | Put a file on the tray (also unhides its chain) |
| `/tray remove <path or N>` | Take a file off the tray |
| `/tray clear` | Empty the tray |
| `/tray list` | Print every doc on the tray, numbered |
| `/tray next` / `/tray prev` | Scroll a page |
| `/tray open N` / `/tray reveal N` | Open or reveal doc N from `/tray list` |

## Limitations

- **Arrow keys and Delete don't work in the tray.** Claude Code's band above the prompt only accepts single-letter or digit hotkeys and Tab/Enter, so Doc Tray uses `j`/`k`, `1`–`3` and Tab-to-**x** instead. The `/tray` commands cover the rest.
- **Only files Claude Code writes are captured** (Write, Edit, MultiEdit, NotebookEdit). Files made by shell commands (for example `pandoc` in Bash) need `/tray add <path>`.
- **Windows:** `explorer.exe` reports failure even when it works, so Doc Tray can't tell if an open failed there. A missing file is still caught.
- **Linux:** Reveal opens the folder; most file managers can't select the file through `xdg-open`.
- The tray draws in the terminal and the desktop app's Code tab. VS Code and mobile have no band above the prompt; use `/tray list` there.

## Uninstall

```
/plugin uninstall doc-tray
```

Then, if you added the marketplace only for this: `/plugin marketplace remove doc-tray-for-claude-code`. Uninstalling never touches your files.

## Development

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .      # run it live; this also writes .claude-plugin/types/
tsc -p .
```

- The tray logic is in `hooks/core.ts`; the hooks are in `hooks/register.tsx`; the state contract is `types/index.d.ts`; the tests are in `hooks/tray.test.ts`.
- See [docs/RIVALS.md](docs/RIVALS.md) for how Doc Tray compares to similar tools, and [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md) for why it ships as a plugin.

---

Built by [Quantum Armadillo](https://quantumarmadillo.com)
