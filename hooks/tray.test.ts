import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { chainKey } from './core'

const ROOT = '/work/proj'
const SURFACES = ['terminal', 'desktop'] as const

type World = {
  files: Map<string, number>
  runs: string[][]
  toasts: string[]
  failNext: boolean
  denyWrites: boolean
}

/** The engine beneath the plugin: a fake file system, host, store and session. */
function world(on: On, files: Record<string, number> = {}, os = 'Darwin', env: Record<string, string> = {}): World {
  const w: World = { files: new Map(Object.entries(files)), runs: [], toasts: [], failNext: false, denyWrites: false }
  mock.store(on)
  mock.env(on, env)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  // The engine's own band when the tray passes: an empty box.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  on('session.root', () => ({ value: ROOT }))
  on('session.cwd', () => ({ value: ROOT }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.toast', (_$, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('fs.stat', (_$, e) => {
    const mtime = w.files.get(e.path)
    if (mtime === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: { kind: 'file' as const, size: 1, mtimeMs: mtime, isLink: false } }
  })
  on('process.run', (_$, e) => {
    if (e.argv[0] === 'uname') return { value: { exitCode: 0, stdout: `${os}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    w.runs.push([...e.argv])
    const exitCode = w.failNext ? 1 : 0
    w.failNext = false
    return { value: { exitCode, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.call', () =>
    w.denyWrites ? { deny: 'denied' } : ({ result: { type: 'create', filePath: '', content: '' } } as never),
  )
  return w
}

async function start($: Engine) {
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
}

/** A successful Write the model made, as the engine raises it. */
async function write($: Engine, w: World, name: string, mtime: number) {
  const path = `${ROOT}/${name}`
  w.files.set(path, mtime)
  await $.tool.call({ tool: 'Write', file_path: path, content: 'x' })
  return path
}

async function band($: Engine, surface: (typeof SURFACES)[number]) {
  return $.ui.mount({
    plugin: 'doc-tray',
    surface,
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 12,
      bodyColumns: 100,
      scroll: { offset: 0, bodyRows: 11 },
      view: {},
    },
  })
}

/** `/tray <args>` as the person types it; resolves to its output text. */
async function tray($: Engine, args: string) {
  const ran = await $.command.run({
    command: 'tray',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 100 },
  })
  return ran.text ?? ''
}

async function list($: Engine) {
  return tray($, 'list')
}

describe('chain keys', () => {
  test('match the SPEC reference cases', () => {
    expect(chainKey('HANDOFF-2026-10-06-1800-director.md')).toBe('HANDOFF')
    expect(chainKey('MASTER-EXECUTION-OUTLINE-2026-10-05.md')).toBe('OUTLINE')
    expect(chainKey('MARKET-REPORT-2026-10-06.html')).toBe('V:MARKET-REPORT.html')
    expect(chainKey('DELL-CLEAR-LIST-2026-10-06.md')).toBe('V:DELL-CLEAR-LIST.md')
    expect(chainKey('NOTES.md')).toBeUndefined()
    expect(chainKey('plan-v2.md')).toBe('V:plan.md')
    expect(chainKey('plan-v2.1.md')).toBe('V:plan.md')
    expect(chainKey('2026-10-06.md')).toBeUndefined()
  })
})

describe('auto-capture', () => {
  test('a Write of a doc lands on the tray; other files do not', async ($, on) => {
    const w = world(on)
    await start($)
    await write($, w, 'report.md', 1)
    await write($, w, 'index.ts', 2)
    expect(await list($)).toBe(`1. ${ROOT}/report.md`)
  })

  test('extensions come from userConfig', { options: { extensions: '.txt' } }, async ($, on) => {
    const w = world(on)
    await start($)
    await write($, w, 'report.md', 1)
    await write($, w, 'notes.txt', 2)
    expect(await list($)).toBe(`1. ${ROOT}/notes.txt`)
  })

  test('a failed write is not captured', async ($, on) => {
    const w = world(on)
    w.denyWrites = true
    await start($)
    await write($, w, 'report.md', 1)
    expect(await list($)).toBe('Doc Tray is empty.')
  })
})

describe('chains', () => {
  test('a newer version supersedes the older one in its slot', async ($, on) => {
    const w = world(on)
    await start($)
    await write($, w, 'MARKET-REPORT-2026-10-05.html', 1)
    await write($, w, 'NOTES.md', 2)
    await write($, w, 'MARKET-REPORT-2026-10-06.html', 3)
    expect(await list($)).toBe(
      [`1. ${ROOT}/NOTES.md`, `2. ${ROOT}/MARKET-REPORT-2026-10-06.html`].join('\n'),
    )
  })

  test('[x] hides the whole chain; adding again unhides it', async ($, on) => {
    const w = world(on)
    await start($)
    const v1 = await write($, w, 'HANDOFF-2026-10-06-1800.md', 1)
    for (const surface of SURFACES) {
      const ui = await band($, surface)
      expect(await ui.find({ key: 'open-1' })).toBeDefined()
      await ui.unmount()
    }
    const ui = await band($, 'terminal')
    await ui.press({ key: 'remove-1' })
    await ui.unmount()
    expect(await list($)).toBe('Doc Tray is empty.')

    await write($, w, 'HANDOFF-2026-10-06-1700.md', 0)
    expect(await list($)).toBe('Doc Tray is empty.')

    await tray($, `add ${v1}`)
    expect(await list($)).toBe(`1. ${v1}`)
    expect(w.files.has(v1)).toBe(true)
  })
})

describe('open and reveal', () => {
  test('clicking a name opens it, Reveal reveals it (macOS)', async ($, on) => {
    const w = world(on, {}, 'Darwin')
    await start($)
    const path = await write($, w, 'report.md', 1)
    for (const surface of SURFACES) {
      w.runs.length = 0
      const ui = await band($, surface)
      await ui.press({ key: 'open-1' })
      await ui.press({ key: 'reveal-1' })
      await ui.unmount()
      expect(w.runs).toEqual([['open', path], ['open', '-R', path]])
    }
  })

  test('Linux uses xdg-open on the file and its folder', async ($, on) => {
    const w = world(on, {}, 'Linux')
    await start($)
    const path = await write($, w, 'report.md', 1)
    await tray($, 'open 1')
    await tray($, 'reveal 1')
    expect(w.runs).toEqual([['xdg-open', path], ['xdg-open', ROOT]])
  })

  test('Windows uses explorer', async ($, on) => {
    const w = world(on, {}, 'Windows', { OS: 'Windows_NT' })
    await start($)
    const path = await write($, w, 'report.md', 1)
    await tray($, 'open 1')
    await tray($, 'reveal 1')
    expect(w.runs).toEqual([['explorer', path], ['explorer', `/select,${path}`]])
  })

  test('a failing command or a missing file is a toast, not a throw', async ($, on) => {
    const w = world(on)
    await start($)
    const path = await write($, w, 'report.md', 1)
    w.failNext = true
    const ui = await band($, 'terminal')
    await ui.press({ key: 'open-1' })
    w.files.delete(path)
    await ui.press({ key: 'reveal-1' })
    await ui.unmount()
    expect(w.toasts).toHaveLength(2)
    expect(w.toasts[1]).toContain('no longer exists')
  })
})

describe('scrolling', () => {
  test('more than 3 docs: 3 rows, ^ v and a position readout', async ($, on) => {
    const w = world(on)
    await start($)
    for (let i = 1; i <= 5; i += 1) await write($, w, `doc${i}.md`, i)
    for (const surface of SURFACES) {
      await tray($, 'prev')
      const ui = await band($, surface)
      expect(await ui.find({ key: 'open-3' })).toBeDefined()
      expect(await ui.find({ key: 'open-4' })).toBeUndefined()
      expect(await ui.find({ text: /1-3 of 5/ })).toBeDefined()
      await ui.press({ key: 'down' })
      expect(await ui.find({ text: /2-4 of 5/ })).toBeDefined()
      await ui.press({ key: 'down' })
      await ui.press({ key: 'down' })
      expect(await ui.find({ text: /3-5 of 5/ })).toBeDefined()
      await ui.press({ key: 'up' })
      expect(await ui.find({ text: /2-4 of 5/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('keyboard: j/k hotkeys move the window, digits open a row', async ($, on) => {
    const w = world(on)
    await start($)
    for (let i = 1; i <= 4; i += 1) await write($, w, `doc${i}.md`, i)
    const ui = await band($, 'terminal')
    expect((await ui.find({ key: 'down' }))?.props.hotkey).toBe('j')
    expect((await ui.find({ key: 'up' }))?.props.hotkey).toBe('k')
    expect((await ui.find({ key: 'open-2' }))?.props.hotkey).toBe('2')
    await ui.unmount()
  })

  test('keyboard fallback: /tray next | prev | open N | remove N', async ($, on) => {
    const w = world(on)
    await start($)
    for (let i = 1; i <= 7; i += 1) await write($, w, `doc${i}.md`, i)
    expect(await tray($, 'next')).toBe('Doc Tray: 4-6 of 7')
    expect(await tray($, 'next')).toBe('Doc Tray: 5-7 of 7')
    expect(await tray($, 'prev')).toBe('Doc Tray: 2-4 of 7')
    await tray($, 'open 2')
    expect(w.runs).toEqual([['open', `${ROOT}/doc6.md`]])
    await tray($, 'remove 1')
    expect(await list($)).not.toContain('doc7.md')
  })
})

describe('on/off', () => {
  test('/tray off hides the band, /tray on brings it back', async ($, on) => {
    const w = world(on)
    await start($)
    await write($, w, 'report.md', 1)
    expect(await tray($, 'off')).toBe('Doc Tray is off.')
    let ui = await band($, 'terminal')
    expect(await ui.find({ key: 'open-1' })).toBeUndefined()
    await ui.unmount()
    await tray($, 'toggle')
    ui = await band($, 'terminal')
    expect(await ui.find({ key: 'open-1' })).toBeDefined()
    await ui.unmount()
  })

  test('/tray clear empties the tray', async ($, on) => {
    const w = world(on)
    await start($)
    await write($, w, 'report.md', 1)
    await tray($, 'clear')
    expect(await list($)).toBe('Doc Tray is empty.')
  })
})
