/**
 * '⌘' on Apple platforms, 'Ctrl' everywhere else — fills the {mod} slot in
 * shortcut-carrying tooltip strings (canvas.toolbar.*, shell.undoRedo.*).
 * The one place in the app that reads navigator.platform (guarded so pure
 * node imports don't blow up).
 */
export const shortcutMod = (): string =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'
