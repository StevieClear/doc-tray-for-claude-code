/** One document on the tray: its absolute path and its mtime when captured. */
export type TrayDoc = { path: string; mtime: number }

/** What the tray keeps per project in `$.store`. */
export type TrayData = {
  /** Docs in tray order, at most one per chain, newest first for new ones. */
  docs: TrayDoc[]
  /** Chain keys taken off the tray with [x]; adding a member again unhides. */
  hidden: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'doc-tray': {
      /** The project's tray, mirrored from `$.store`. */
      data: TrayData
      /** Index of the first row shown in the 3-row window. */
      offset: number
      /** False after `/tray off`. */
      isOn: boolean
    }
  }
}
