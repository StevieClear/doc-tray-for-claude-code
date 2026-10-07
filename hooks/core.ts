// Pure tray logic: chain keys, add/remove/prune, the scroll window and the
// platform commands. Nothing here touches `$`, so the tests can call it as is.

import type { TrayData, TrayDoc } from '../types'

export const WINDOW = 3
export const CAP = 50
export const DEFAULT_EXTENSIONS = '.md .html .pdf .xlsx .csv .docx .pptx'

export type Platform = 'mac' | 'linux' | 'windows'

export const EMPTY: TrayData = { docs: [], hidden: [] }

export function baseName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

export function dirName(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (cut < 0) return '.'
  if (cut === 0) return path.slice(0, 1)
  return path.slice(0, cut)
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot) : ''
}

/** The extensions list from config: `.md html  .PDF` -> ['.md', '.html', '.pdf']. */
export function parseExtensions(text: string | undefined): string[] {
  const list = (text ?? DEFAULT_EXTENSIONS)
    .split(/[\s,]+/)
    .filter(one => one.length > 0)
    .map(one => (one.startsWith('.') ? one : `.${one}`).toLowerCase())
  return list.length > 0 ? list : parseExtensions(DEFAULT_EXTENSIONS)
}

export function isDoc(path: string, extensions: readonly string[]): boolean {
  return extensions.includes(extOf(baseName(path)).toLowerCase())
}

const SEP = '[-_ .]'

/**
 * The chain a filename belongs to (SPEC §2), or undefined when it has none.
 * HANDOFF* -> HANDOFF, *OUTLINE* -> OUTLINE, a dated or versioned name ->
 * `V:<stem><ext>` with the date, a standalone 4-digit time and a trailing
 * -vN / -vN.N stripped.
 */
export function chainKey(path: string): string | undefined {
  const name = baseName(path)
  if (/^handoff/i.test(name)) return 'HANDOFF'
  if (/outline/i.test(name)) return 'OUTLINE'

  const ext = extOf(name)
  const stem = ext ? name.slice(0, -ext.length) : name
  let s = stem
    .replace(/\d{4}-\d{2}-\d{2}/g, '')
    .replace(new RegExp(`(^|${SEP})\\d{4}(?=${SEP}|$)`, 'g'), '$1')
  s = collapse(s)
  s = collapse(s.replace(new RegExp(`${SEP}v\\d+(\\.\\d+)?$`, 'i'), ''))
  if (s === stem || s.length === 0) return undefined
  return `V:${s}${ext}`
}

function collapse(s: string): string {
  return s
    .replace(new RegExp(`${SEP}{2,}`, 'g'), m => m[0] ?? '')
    .replace(new RegExp(`^${SEP}+|${SEP}+$`, 'g'), '')
}

/**
 * Puts `doc` on the tray: unhides its chain, takes the chain's slot (or the
 * top for a new doc), keeps only the newest member, and caps the list.
 */
export function addDoc(data: TrayData, doc: TrayDoc): TrayData {
  const key = chainKey(doc.path)
  const sameSlot = (one: TrayDoc) =>
    one.path === doc.path || (key !== undefined && chainKey(one.path) === key)

  const slot = data.docs.findIndex(sameSlot)
  const members = data.docs.filter(sameSlot)
  const newest = [doc, ...members].reduce((best, one) =>
    one.mtime > best.mtime ? one : best,
  )
  const rest = data.docs.filter(one => !sameSlot(one))
  const docs =
    slot < 0
      ? [newest, ...rest]
      : [...rest.slice(0, slot), newest, ...rest.slice(slot)]

  return {
    docs: docs.slice(0, CAP),
    hidden: data.hidden.filter(one => one !== key),
  }
}

/**
 * Takes `path` off the tray. A versioned doc hides its whole chain, so an
 * older version cannot come back. Never touches the file.
 */
export function removeDoc(data: TrayData, path: string): TrayData {
  const key = chainKey(path)
  const docs = data.docs.filter(
    one => one.path !== path && (key === undefined || chainKey(one.path) !== key),
  )
  const hidden =
    key === undefined || data.hidden.includes(key) ? data.hidden : [...data.hidden, key]
  return { docs, hidden }
}

/** Whether an auto-captured write should land: not in a hidden chain. */
export function isHidden(data: TrayData, path: string): boolean {
  const key = chainKey(path)
  return key !== undefined && data.hidden.includes(key)
}

export function clampOffset(offset: number, count: number): number {
  const max = Math.max(0, count - WINDOW)
  return Math.min(Math.max(0, offset), max)
}

/** `4-6 of 9` */
export function position(offset: number, count: number): string {
  const first = Math.min(count, offset + 1)
  const last = Math.min(count, offset + WINDOW)
  return `${first}-${last} of ${count}`
}

/** The tray label for a doc: its file name, `.md` dropped, middle-cut to fit. */
export function label(path: string, width: number): string {
  const name = baseName(path).replace(/\.md$/i, '')
  if (name.length <= width) return name
  const keep = Math.max(1, width - 1)
  const head = Math.ceil(keep / 2)
  return `${name.slice(0, head)}…${name.slice(name.length - (keep - head))}`
}

export function openArgv(platform: Platform, path: string): string[] {
  if (platform === 'mac') return ['open', path]
  if (platform === 'windows') return ['explorer', path]
  return ['xdg-open', path]
}

export function revealArgv(platform: Platform, path: string): string[] {
  if (platform === 'mac') return ['open', '-R', path]
  if (platform === 'windows') return ['explorer', `/select,${path}`]
  return ['xdg-open', dirName(path)]
}

/** Absolute or not: `C:\x`, `\\server\x`, `/x`. */
export function isAbsolute(path: string): boolean {
  return path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path)
}

export function joinPath(dir: string, path: string): string {
  if (isAbsolute(path)) return path
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/'
  return `${dir.replace(/[\\/]+$/, '')}${sep}${path.replace(/^\.[\\/]/, '')}`
}
