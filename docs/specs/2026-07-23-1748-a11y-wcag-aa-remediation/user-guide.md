# User guide — Accessibility remediation (WCAG AA)

## What changed for users

- **Colors meet WCAG AA everywhere in normal mode.** Accent-colored text, links, tabs and
  primary buttons are automatically darkened (per accent, per theme) just enough to reach
  a 4.5:1 contrast ratio. The default purple barely changes; blue, teal and amber shift
  more noticeably when used as text/links. Swatches in Settings keep their brand colors.
- **Muted/secondary text is darker** (template descriptions, version stamps, gallery hints)
  in both light and dark themes.
- **The "Ready" status chip** (problems button, no-issues state) uses a darker green that
  is readable on white — including in high-contrast mode.
- **Screen-reader fixes:** the form-structure canvas exposes a valid tree; the Default
  property field, and every cell in the Translations dialog grid, announce a proper label
  (e.g. "age · Label — fr"); the Translations dialog's maximize button has a name; the
  help drawer announces as a dialog; PrimeVue's built-in buttons (dialog/drawer close)
  announce in the interface language (en/fr/es).
- **High-contrast and dark modes** are unchanged apart from the Ready-chip fix — they were
  already clean.

## Running the audit yourself

```bash
pnpm audit:a11y                                  # live deployment, 4 theme×contrast modes
pnpm audit:a11y --url http://localhost:4173/     # against a local pnpm build && pnpm preview
pnpm audit:a11y --accent all --contrast normal   # full accent sweep (slow)
```

CI runs a reduced matrix on every push; a violation fails the build.

## Manual test scenarios

1. **Accent sweep:** Settings → Theme → cycle all six accents in light theme. Links
   (library footer credits/backup link), the active tab in Form settings, and the
   "Learn more" callout link must all be comfortably readable; primary buttons keep
   readable labels. Repeat in dark theme.
2. **Templates gallery:** New form → gallery card descriptions/previews/question-counts are
   readable on the card background in both themes.
3. **Problems chip:** open a form with no issues — "Ready" is readable; add a broken
   expression — warning/error states unchanged.
4. **Screen reader (or browser a11y inspector):** editor canvas announces "Form structure,
   tree"; question cards are treeitems with selection state; the empty-canvas hint is NOT
   inside the tree. Properties → Default announces "Default". Translations dialog: each
   grid cell announces row + column; the maximize button announces its label.
5. **Locale switch:** Settings → Français — dialog close buttons announce in French.
6. **Keyboard:** canvas Ctrl+A / Delete / Alt+arrows / Up/Down roving focus unchanged;
   Esc still closes one overlay level at a time.
7. **Icons check (deferred decision):** compare the browser-tab/PWA icon purple with the
   in-app primary purple; if visibly mismatched, raise the icon-regeneration follow-up.
