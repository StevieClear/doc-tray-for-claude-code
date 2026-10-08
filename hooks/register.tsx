import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { TrayData, TrayDoc } from '../types'
import {
  EMPTY,
  WINDOW,
  addDoc,
  baseName,
  clampOffset,
  isDoc,
  isHidden,
  joinPath,
  label,
  openArgv,
  parseExtensions,
  position,
  removeDoc,
  revealArgv,
} from './core'
import type { Platform } from './core'

const data = atom({ plugin: 'doc-tray', key: 'data' } as const, EMPTY)
const offset = atom({ plugin: 'doc-tray', key: 'offset' } as const, 0)
const isOn = atom({ plugin: 'doc-tray', key: 'isOn' } as const, true)

const WRITE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']

const HELP = [
  'Usage: /tray [on | off | toggle | list | clear]',
  '       /tray add <path> | remove <path or N>',
  '       /tray next | prev | open N | reveal N',
].join('\n')

type $ = EngineInterface

let extensions: string[] = parseExtensions(undefined)
let platform: Platform | undefined

async function projectKey($: $) {
  return `project:${await $.session.root()}`
}

async function save($: $, fn: (now: TrayData) => TrayData) {
  const next = await update($, data, fn)
  await update($, offset, n => clampOffset(n, next.docs.length))
  await $.store.set(await projectKey($), next)
  return next
}

async function detect($: $): Promise<Platform> {
  if (platform) return platform
  if ((await $.env.get('OS')) === 'Windows_NT') return (platform = 'windows')
  try {
    const { stdout } = await $.process.run(['uname', '-s'], { timeoutMs: 5000 })
    platform = stdout.trim() === 'Darwin' ? 'mac' : 'linux'
  } catch {
    platform = 'linux'
  }
  return platform
}

/** Runs open / reveal; a failure is a toast, never a throw. */
async function launch($: $, kind: 'open' | 'reveal', path: string) {
  try {
    const stat = await $.fs.stat(path).catch(() => undefined)
    if (!stat || stat.kind === 'other') {
      $.ui.toast(`Doc Tray: ${baseName(path)} no longer exists`)
      return false
    }
    const os = await detect($)
    const argv = kind === 'open' ? openArgv(os, path) : revealArgv(os, path)
    const { exitCode } = await $.process.run(argv, { timeoutMs: 10000 })
    // explorer.exe exits 1 even when it worked, so Windows is judged by start alone.
    if (exitCode !== 0 && os !== 'windows') {
      $.ui.toast(`Doc Tray: could not ${kind} ${baseName(path)} (${argv[0]} exited ${exitCode})`)
      return false
    }
    return true
  } catch {
    $.ui.toast(`Doc Tray: could not ${kind} ${baseName(path)}`)
    return false
  }
}

async function capture($: $, raw: string, isManual: boolean) {
  const path = joinPath(await $.session.cwd(), raw)
  const stat = await $.fs.stat(path).catch(() => undefined)
  if (!stat || stat.kind !== 'file') return undefined
  const current = await read($, data)
  if (!isManual && isHidden(current, path)) return undefined
  const doc: TrayDoc = { path, mtime: stat.mtimeMs }
  await save($, now => addDoc(now, doc))
  return doc
}

async function nth($: $, text: string | undefined) {
  const n = Number(text)
  const { docs } = await read($, data)
  return Number.isInteger(n) && n >= 1 ? docs[n - 1] : undefined
}

async function scroll($: $, by: number) {
  const { docs } = await read($, data)
  return update($, offset, n => clampOffset(n + by, docs.length))
}

export const register: Register = (on, options) => {
  extensions = parseExtensions(
    typeof options.extensions === 'string' ? options.extensions : undefined,
  )
  platform = undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tray',
      description: 'Doc Tray: show, hide, add, remove, scroll or list tray docs',
      argumentHint: '[on|off|toggle|add <path>|remove <path|N>|clear|list|next|prev|open N|reveal N]',
    })
    const stored = (await $.store.get(await projectKey($))) as TrayData | undefined
    const enabled = await $.store.get('enabled')
    await update($, data, () => stored ?? EMPTY)
    await update($, isOn, () => enabled !== false)
    await update($, offset, () => 0)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (!WRITE_TOOLS.includes(String(e.tool))) return ran
    try {
      const input = e as unknown as { file_path?: unknown; notebook_path?: unknown }
      const raw = input.file_path ?? input.notebook_path
      const isOk = ran.deny === undefined && ran.isError !== true
      if (isOk && typeof raw === 'string' && isDoc(raw, extensions)) {
        await capture($, raw, false)
      }
    } catch {
      // Capture is best effort; the tool call's own result always stands.
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'tray' }, async ($, e) => {
    const [verb = 'toggle', ...rest] = e.args.trim().split(/\s+/).filter(Boolean)
    const arg = rest.join(' ')

    const setOn = async (value: boolean) => {
      await update($, isOn, () => value)
      await $.store.set('enabled', value)
      return { text: `Doc Tray is ${value ? 'on' : 'off'}.` }
    }

    switch (verb) {
      case 'on':
        return setOn(true)
      case 'off':
        return setOn(false)
      case 'toggle':
        return setOn(!(await read($, isOn)))
      case 'add': {
        if (!arg) return { text: 'Usage: /tray add <path>' }
        const doc = await capture($, arg, true)
        return { text: doc ? `Added ${baseName(doc.path)}.` : `No file at ${arg}.` }
      }
      case 'remove': {
        if (!arg) return { text: 'Usage: /tray remove <path or N>' }
        const byNumber = await nth($, arg)
        const path = byNumber?.path ?? joinPath(await $.session.cwd(), arg)
        const { docs } = await read($, data)
        if (!docs.some(one => one.path === path)) return { text: `${arg} is not on the tray.` }
        await save($, now => removeDoc(now, path))
        return { text: `Removed ${baseName(path)} from the tray (the file is untouched).` }
      }
      case 'clear':
        await save($, () => EMPTY)
        return { text: 'Doc Tray cleared.' }
      case 'list': {
        const { docs } = await read($, data)
        if (docs.length === 0) return { text: 'Doc Tray is empty.' }
        return { text: docs.map((one, i) => `${i + 1}. ${one.path}`).join('\n') }
      }
      case 'next':
      case 'prev': {
        const at = await scroll($, verb === 'next' ? WINDOW : -WINDOW)
        const { docs } = await read($, data)
        return { text: `Doc Tray: ${position(at, docs.length)}` }
      }
      case 'open':
      case 'reveal': {
        const doc = await nth($, arg)
        if (!doc) return { text: `Usage: /tray ${verb} N (see /tray list)` }
        const isDone = await launch($, verb, doc.path)
        return { text: isDone ? `${verb === 'open' ? 'Opened' : 'Revealed'} ${baseName(doc.path)}.` : `Could not ${verb} ${baseName(doc.path)}.` }
      }
      default:
        return { text: HELP }
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { docs } = await read($, data)
    if (e.props.hasSurvey || !(await read($, isOn)) || docs.length === 0) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const at = clampOffset(await read($, offset), docs.length)
    const shown = docs.slice(at, at + WINDOW)
    const width = Math.max(8, e.props.bodyColumns - 30)

    return (
      <Box flexDirection="column">
        {shown.map((doc, i) => (
          <Box key={`row-${i + 1}`} flexDirection="row">
            <Text dimColor>{i === 0 ? 'Tray  ' : '      '}</Text>
            <Button
              key={`open-${i + 1}`}
              label={label(doc.path, width)}
              hotkey={String(i + 1)}
              onPress={() => launch($, 'open', doc.path)}
            />
            <Text> </Text>
            <Button key={`reveal-${i + 1}`} label="Reveal" dimColor onPress={() => launch($, 'reveal', doc.path)} />
            <Text> </Text>
            <Button key={`remove-${i + 1}`} label="x" dimColor onPress={() => save($, now => removeDoc(now, doc.path))} />
          </Box>
        ))}
        {docs.length > WINDOW && (
          <Box key="scroll" flexDirection="row">
            <Text>{'      '}</Text>
            <Button key="up" label="^" hotkey="k" onPress={() => scroll($, -1)} />
            <Text> </Text>
            <Button key="down" label="v" hotkey="j" onPress={() => scroll($, 1)} />
            <Text dimColor> {position(at, docs.length)}</Text>
          </Box>
        )}
      </Box>
    )
  })
}
