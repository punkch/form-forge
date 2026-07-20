# References for Template Management

## Similar implementations (in-repo)

### `FormLibraryView.confirmDelete` (the confirm-payload shape)

- **Location:** `src/views/FormLibraryView.vue:119-129`
- **Relevance:** the app's one established pattern for a destructive confirm; the new
  saved-template delete confirm must match it exactly rather than invent a variant.
- **Key patterns:**
  ```ts
  const confirmDelete = (record: FormRecord): void => {
    confirm.require({
      header: t('library.deleteConfirm.header'),
      message: t('library.deleteConfirm.message', { title: record.title }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: t('common.delete'),
      rejectLabel: t('common.cancel'),
      acceptProps: { severity: 'danger' },
      accept: () => { void workspace.deleteForm(record.id) },
    })
  }
  ```
  `useConfirm()` from `primevue/useconfirm` is imported and instantiated once
  (`const confirm = useConfirm()`); the destructive action only runs inside `accept`. The
  app already mounts a single global `<ConfirmDialog />` in `App.vue`, so no per-component
  dialog registration is needed — `confirm.require(...)` is enough.

### `src/stores/ui.ts` — `dismissedCallouts` (the persisted-string-array pattern)

- **Location:** `src/stores/ui.ts` (interface at ~:65, guarded ref at ~:133-136, actions at
  ~:161-167, export at ~:198, apply-guard at ~:231-232, watch list at ~:237, return object
  at ~:276-284)
- **Relevance:** `hiddenBundledTemplates` is the same shape — a persisted array of stable
  string ids, exposed via membership-test/add/remove/reset actions — so it is built by
  mirroring this field at every one of its seven touch points rather than designing a new
  pattern.
- **Key patterns:**
  - `PersistedUiState.dismissedCallouts: string[]`
  - Guarded hydration: `Array.isArray(persisted.dismissedCallouts) ? persisted
    .dismissedCallouts.filter((id): id is string => typeof id === 'string') : []`
  - Immutable-replacement mutators: `dismissCallout(id)` appends only if not already present
    (`if (!dismissedCallouts.value.includes(id)) { dismissedCallouts.value = [...
    dismissedCallouts.value, id] }`); `isCalloutDismissed(id)` is a plain `.includes` check.
  - Included verbatim in `exportPreferences()` (`dismissedCallouts: [...
    dismissedCallouts.value]`) and guarded the same way in `applyPreferences()`
    (`if (Array.isArray(p.dismissedCallouts)) { ... }`).
  - Listed in the `watch([...])` dependency array that triggers persistence, and returned
    from the store's setup function.
  - `STORAGE_VERSION = 1` is untouched by this field's addition — confirms Decision 3 is
    already the codebase's own precedent (new persisted-array fields don't bump the
    version).

### `NewFormDialog.vue` local-card markup (the shape bundled cards must adopt)

- **Location:** `src/components/library/NewFormDialog.vue:174-200` (existing local-card
  block); the current bundled-card block is a single `<button class="template-card">`
  around line 161-167.
- **Relevance:** hiding a starter needs a second interactive control (a hide icon) sitting
  next to the card's primary click target, which is invalid inside a single `<button>`.
  The local (saved-template) cards already solve this exact problem for their delete
  button — the bundled cards must be restructured to the same shape, reusing its CSS.
- **Key patterns:**
  ```html
  <div class="template-card local-card" data-testid="new-form-local-template">
    <button type="button" class="local-card-main" data-testid="new-form-local-open"
            @click="pick({ kind: 'local', record })">
      <span class="template-title">{{ record.title }}<Tag .../></span>
      ...
    </button>
    <Button ... class="local-card-delete" data-testid="new-form-local-delete"
            @click="removeLocal(record)" />
  </div>
  ```
  Outer `<div class="template-card ...">` wrapper → inner `<button class="…-main">` carries
  the primary selection click and most of the card's visual content → a sibling icon
  `Button` (absolutely positioned via `.local-card-delete`, `position: relative` on the
  wrapper) carries the secondary action. The existing `.template-card` / `.local-card` /
  `.local-card-main` / `.local-card-delete` CSS (~:275-325) already handles hover/cursor
  states for both the wrapper-button and the plain-button forms (`button.template-card,
  .local-card-main { cursor: pointer; }`) — reuse it rather than adding new rules, per the
  plan's markup-constraint note.

### `ImportCollisionPanel` (the established Copy/Replace prompt shape)

- **Location:** `src/components/importexport/ImportCollisionPanel.vue`
- **Relevance:** the save-template name-collision prompt (Task 5) is explicitly asked to
  mirror this component's shape rather than invent a new interaction — it is the codebase's
  one existing "two destructive-adjacent choices, inline, not a modal-over-modal" pattern.
- **Key patterns:** purely presentational — the host owns collision detection and the
  actual write calls; the panel only renders a message plus two buttons and emits which one
  was picked (`copy` / `replace`). Props: `message`, `copyLabel`, `replaceLabel`, `landing`
  (disables + spinners both buttons while a write is in flight), `testidPrefix` (roots
  `${testidPrefix}`, `${testidPrefix}-copy`, `${testidPrefix}-replace`). Replace renders
  `severity="danger"`; Copy renders `severity="secondary"`. Already shared by two hosts
  (`LibraryCentralDrawer`'s Central import and `ImportDialog`'s ZIP-bundle path), each
  supplying its own i18n copy and testid prefix — the save-template dialog becomes a third
  host of the same shape (or reuses the component directly, whichever the collision-inline
  layout in the save-template dialog allows).

## External references

None — this feature is entirely internal UI/store/persistence work with no XLSForm/XForm
serialization surface, so there is no pyxform-parity or spec-compliance dimension to probe.
