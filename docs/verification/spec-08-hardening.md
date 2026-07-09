# Spec 08 verification (final hardening pass)

- [x] 319 unit/component tests, 38 files, coverage thresholds enforced
      (core 86/78/88, stores 80/85, persistence 90/92 — all passing).
- [x] 18/18 Playwright tests on chromium + firefox, stable across two
      consecutive full runs (flake found & fixed: Escape was consumed by
      the language-select overlay under CPU load; the test now closes the
      dialog deterministically).
- [x] Firefox download quirk fixed (anchor must be in-document).
- [x] Tablet (1024×768): palette auto-hides, header toggle restores it as
      a drawer; preview overlays from the right below 1280px
      (screenshots/spec08-tablet.png).
- [x] Keyboard-only session: ↑/↓ roam cards, Alt+arrows restructure,
      Delete removes, Ctrl+Z/Y undo/redo, palette items insert on Enter.
- [x] lint, typecheck, build all clean; odk-web-forms stays a lazy chunk.

**Verified 2026-07-09.**
