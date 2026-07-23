import { defaultOptions, type PrimeVueConfiguration, type PrimeVueLocaleAriaOptions, type PrimeVueLocaleOptions } from 'primevue/config'

import type { AppLocale } from './index'

/**
 * PrimeVue's own accessible-name strings for its built-in controls — Dialog
 * and Drawer close buttons, Paginator/DataTable row and filter labels,
 * OrderList/PickList move buttons, Galleria zoom/rotate, etc. Every one of
 * these is read straight off PrimeVue's reactive config
 * (`config.locale.aria.*`, e.g. Dialog's `closeAriaLabel` computed), never
 * through the app's `t()`. That's why this catalog is deliberately kept
 * OUTSIDE the app's vue-i18n `MessageSchema` (src/i18n/index.ts) — it's
 * vendor copy, not app copy.
 *
 * Only `locale.aria` is translated. Every other `PrimeVueLocaleOptions` field
 * (day/month names, filter/calendar labels, password-strength labels, …) is
 * carried over verbatim from PrimeVue's English defaults — none of those
 * surfaces are in scope here (the one component in this app that reads them,
 * the `DatePicker` in ConditionRow.vue, keeps English day/month names).
 *
 * The locale union is the shared `AppLocale` from src/i18n/index.ts — the
 * same union `createI18n` is instantiated with — so adding a locale there
 * makes the `PRIMEVUE_LOCALES` map below fail compilation until it gains the
 * matching PrimeVue entry.
 */
export type { AppLocale }

// PrimeVue's shipped English defaults — the base every locale entry below
// starts from, so fields outside `aria` (day names, filter labels, …) stay
// byte-identical to upstream regardless of UI locale.
const englishLocale: PrimeVueLocaleOptions = defaultOptions.locale!

// `Required` so a translation catalog missing a key is a compile error
// instead of a silently-undefined aria string (assigning a whole new `aria`
// object below replaces the English one outright — it does not merge key by
// key, so a gap here is a gap at runtime too).
const frAria: Required<PrimeVueLocaleAriaOptions> = {
  trueLabel: 'Vrai',
  falseLabel: 'Faux',
  nullLabel: 'Non sélectionné',
  star: '1 étoile',
  stars: '{star} étoiles',
  selectAll: 'Tous les éléments sélectionnés',
  unselectAll: 'Tous les éléments désélectionnés',
  close: 'Fermer',
  previous: 'Précédent',
  next: 'Suivant',
  navigation: 'Navigation',
  scrollTop: 'Haut de page',
  moveTop: 'Déplacer en haut',
  moveUp: 'Déplacer vers le haut',
  moveDown: 'Déplacer vers le bas',
  moveBottom: 'Déplacer en bas',
  moveToTarget: 'Déplacer vers la cible',
  moveToSource: 'Déplacer vers la source',
  moveAllToTarget: 'Tout déplacer vers la cible',
  moveAllToSource: 'Tout déplacer vers la source',
  pageLabel: 'Page {page}',
  firstPageLabel: 'Première page',
  lastPageLabel: 'Dernière page',
  nextPageLabel: 'Page suivante',
  prevPageLabel: 'Page précédente',
  rowsPerPageLabel: 'Lignes par page',
  jumpToPageDropdownLabel: 'Liste déroulante d’accès à une page',
  jumpToPageInputLabel: 'Champ d’accès à une page',
  selectRow: 'Ligne sélectionnée',
  unselectRow: 'Ligne désélectionnée',
  expandRow: 'Ligne développée',
  collapseRow: 'Ligne réduite',
  showFilterMenu: 'Afficher le menu de filtre',
  hideFilterMenu: 'Masquer le menu de filtre',
  filterOperator: 'Opérateur de filtre',
  filterConstraint: 'Contrainte de filtre',
  editRow: 'Modifier la ligne',
  saveEdit: 'Enregistrer la modification',
  cancelEdit: 'Annuler la modification',
  listView: 'Vue en liste',
  gridView: 'Vue en grille',
  slide: 'Diapositive',
  slideNumber: '{slideNumber}',
  zoomImage: 'Zoomer l’image',
  zoomIn: 'Zoomer',
  zoomOut: 'Dézoomer',
  rotateRight: 'Pivoter à droite',
  rotateLeft: 'Pivoter à gauche',
  listLabel: 'Liste d’options',
}

const esAria: Required<PrimeVueLocaleAriaOptions> = {
  trueLabel: 'Verdadero',
  falseLabel: 'Falso',
  nullLabel: 'No seleccionado',
  star: '1 estrella',
  stars: '{star} estrellas',
  selectAll: 'Todos los elementos seleccionados',
  unselectAll: 'Todos los elementos deseleccionados',
  close: 'Cerrar',
  previous: 'Anterior',
  next: 'Siguiente',
  navigation: 'Navegación',
  scrollTop: 'Desplazar arriba',
  moveTop: 'Mover al principio',
  moveUp: 'Mover hacia arriba',
  moveDown: 'Mover hacia abajo',
  moveBottom: 'Mover al final',
  moveToTarget: 'Mover al destino',
  moveToSource: 'Mover al origen',
  moveAllToTarget: 'Mover todo al destino',
  moveAllToSource: 'Mover todo al origen',
  pageLabel: 'Página {page}',
  firstPageLabel: 'Primera página',
  lastPageLabel: 'Última página',
  nextPageLabel: 'Página siguiente',
  prevPageLabel: 'Página anterior',
  rowsPerPageLabel: 'Filas por página',
  jumpToPageDropdownLabel: 'Lista desplegable para ir a una página',
  jumpToPageInputLabel: 'Campo para ir a una página',
  selectRow: 'Fila seleccionada',
  unselectRow: 'Fila deseleccionada',
  expandRow: 'Fila expandida',
  collapseRow: 'Fila contraída',
  showFilterMenu: 'Mostrar menú de filtro',
  hideFilterMenu: 'Ocultar menú de filtro',
  filterOperator: 'Operador de filtro',
  filterConstraint: 'Restricción de filtro',
  editRow: 'Editar fila',
  saveEdit: 'Guardar edición',
  cancelEdit: 'Cancelar edición',
  listView: 'Vista de lista',
  gridView: 'Vista de cuadrícula',
  slide: 'Diapositiva',
  slideNumber: '{slideNumber}',
  zoomImage: 'Ampliar imagen',
  zoomIn: 'Acercar',
  zoomOut: 'Alejar',
  rotateRight: 'Girar a la derecha',
  rotateLeft: 'Girar a la izquierda',
  listLabel: 'Lista de opciones',
}

/**
 * Full PrimeVue locale objects, one per app locale. `Record<AppLocale, …>`
 * means adding a locale to `AppLocale` above without adding its entry here
 * fails compilation — the type-level half of the "no shipped locale is
 * missing PrimeVue strings" guarantee.
 */
const PRIMEVUE_LOCALES: Record<AppLocale, PrimeVueLocaleOptions> = {
  en: englishLocale,
  fr: { ...englishLocale, aria: frAria },
  es: { ...englishLocale, aria: esAria },
}

const isAppLocale = (locale: string): locale is AppLocale =>
  Object.hasOwn(PRIMEVUE_LOCALES, locale)

/** PrimeVue locale object for a UI locale; falls back to English for any locale not covered above. */
export const primeVueLocaleFor = (locale: string): PrimeVueLocaleOptions =>
  isAppLocale(locale) ? PRIMEVUE_LOCALES[locale] : PRIMEVUE_LOCALES.en

/**
 * Live reference to PrimeVue's reactive config object — the same one
 * `usePrimeVue().config` resolves to inside components — registered once by
 * main.ts right after `app.use(PrimeVue, …)` (`app.config.globalProperties
 * .$primevue.config`). Kept as module state, not a store, because it has to
 * be reachable from `setLocale`, which runs outside any component setup.
 */
let primeVueConfig: PrimeVueConfiguration | null = null

/** Registers the live PrimeVue config object; called once, from main.ts. */
export const registerPrimeVueConfig = (config: PrimeVueConfiguration): void => {
  primeVueConfig = config
}

/**
 * Applies `locale`'s PrimeVue strings to the live config, if registered.
 * `config.locale` is reactive (PrimeVue wraps its whole config in Vue's
 * `reactive()`), and built-in components read it through a computed — e.g.
 * Dialog/Drawer's `closeAriaLabel` reads `config.locale.aria.close` — so
 * assigning a new locale object here re-renders any already-open component
 * with the new strings, no remount needed. Called by `setLocale` on every
 * switch (and once at boot, right after main.ts registers the config).
 */
export const applyPrimeVueLocale = (locale: string): void => {
  if (primeVueConfig === null) return
  primeVueConfig.locale = primeVueLocaleFor(locale)
}
