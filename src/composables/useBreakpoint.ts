import { readonly, ref, type Ref } from 'vue'

/**
 * Editor layout modes:
 *  - wide:    ≥1280px — full multi-pane grid with resizable panels
 *  - laptop:  1024–1279px — palette overlays, preview docks narrow
 *  - tablet:  768–1023px — single pane at a time (Canvas/Properties/Preview tabs)
 *  - blocked: <768px — authoring replaced by a "larger screen" notice
 */
export type LayoutMode = 'wide' | 'laptop' | 'tablet' | 'blocked'

const QUERIES: ReadonlyArray<{ mode: LayoutMode, query: string }> = [
  { mode: 'blocked', query: '(max-width: 767px)' },
  { mode: 'tablet', query: '(min-width: 768px) and (max-width: 1023px)' },
  { mode: 'laptop', query: '(min-width: 1024px) and (max-width: 1279px)' },
  { mode: 'wide', query: '(min-width: 1280px)' },
]

let mode: Ref<LayoutMode> | null = null
let viewportWidth: Ref<number> | null = null

const initMode = (): Ref<LayoutMode> => {
  const current = ref<LayoutMode>('wide')
  for (const { mode: m, query } of QUERIES) {
    const mql = window.matchMedia(query)
    if (mql.matches) current.value = m
    mql.addEventListener('change', (event) => {
      if (event.matches) current.value = m
    })
  }
  return current
}

/** Module-singleton breakpoint mode; listeners are registered once. */
export const useBreakpoint = (): { mode: Readonly<Ref<LayoutMode>> } => {
  if (mode === null) mode = initMode()
  return { mode: readonly(mode) }
}

/** Module-singleton reactive viewport width (one shared resize listener). */
export const useViewportWidth = (): Readonly<Ref<number>> => {
  if (viewportWidth === null) {
    const width = ref(window.innerWidth)
    window.addEventListener('resize', () => { width.value = window.innerWidth })
    viewportWidth = width
  }
  return readonly(viewportWidth)
}
