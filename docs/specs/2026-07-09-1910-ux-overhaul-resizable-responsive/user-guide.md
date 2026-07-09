# User Guide — Builder Layout & Preview (post-overhaul)

## Resizable panels (desktop, ≥1280px)

- Drag the thin vertical handles between panels to resize the **question palette**, **properties panel**, and **live preview**. Widths are remembered on this device.
- **Double-click** a handle (or focus it and press **Enter**) to reset that panel to its default width.
- Handles are keyboard-accessible: **Tab** to a handle, then **←/→** to resize (hold **Shift** for bigger steps), **Home/End** for min/max.
- When no question is selected, the properties panel folds into a slim rail so the canvas gets the space; selecting a question slides it back open.
- If the window is too narrow for everything, the palette tucks away automatically and returns when room frees up (your palette on/off choice is remembered separately).

## Live preview

- **Preview** in the header toggles the docked preview. Drag its handle to make it as wide as you like (up to 60% of the window).
- The preview toolbar has device-width presets: **Phone** (360px), **Tablet** (768px), and **Fill**. Phone/Tablet render the form at that exact content width inside a subtle device frame — what respondents will see on their device. The pane widens automatically if needed.
- **Open full-page preview** still opens the form as a full page for realistic fill/submit testing; it's also the best way to test on an actual phone.
- If the form temporarily can't be previewed (for example a group with no questions yet), the last good preview stays visible with a "Preview paused" note explaining what to fix. Engine problems show inside the preview pane with a **Try again** button — they never cover your work.

## Smaller screens

- **Laptop (1024–1279px):** the palette becomes a slide-over drawer (toggle it from the header); the preview docks beside the properties panel and never covers it.
- **Tablet (768–1023px):** the editor shows one pane at a time with **Canvas / Properties / Preview** tabs under the header. The Properties tab shows a dot when a question is selected.
- **Phone (<768px):** form *authoring* asks you to continue on a larger screen, but the form library and the full-page preview remain fully usable — you can review and test-fill any form from a phone.

## Other improvements

- Adding a question (click or drag) inserts it after the currently selected question, scrolls it into view, and briefly highlights it.
- Question cards show a color-tinted icon per category (input / choice / date & time / media / location / display / structure / metadata) for faster scanning.
- The properties panel is organized into collapsible sections — **Basics, Appearance, Choices, Logic** — and remembers which you keep collapsed. Choice lists support drag-to-reorder.
- All motion respects your OS "reduce motion" setting.

## Manual test scenarios (mirrors Task 8)

1. **Resize + persistence:** at 1440px, drag all three handles, reload — widths persist. Double-click each — defaults return.
2. **Presets:** open preview → Phone → framed 360px content; Tablet → pane auto-widens (or clamps gracefully on small windows); Fill → edge-to-edge. Reload — preset persists.
3. **Laptop:** at 1100px, open preview, select a question — properties remain fully visible and editable while the preview updates.
4. **Tablet tabs:** at 900px, build via Canvas tab, edit via Properties tab, check Preview tab; return to Canvas and drag-reorder still works.
5. **Phone:** at 390px, the editor route shows the "larger screen" page; **Open form preview** lets you fill the form; the library works.
6. **Empty group:** add a Group with no children — the card shows a warning, the preview shows "Preview paused…" with the last good render intact, and no error box floats over the editor. Add a child — preview resumes.
7. **Keyboard:** resize panels with the keyboard only; add a question and observe scroll+highlight; enable reduced motion and confirm animations are gone.
