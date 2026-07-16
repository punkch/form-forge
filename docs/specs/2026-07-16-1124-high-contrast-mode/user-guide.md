# High-contrast mode — user guide

Form Forge's colour scheme (light / dark / follow-system) and its accent
colour are joined by a third, independent setting: **contrast**. Turning on
high contrast strengthens text/background separation and boundaries well
beyond the normal theme, targeting the same level ("AAA") that Windows and
macOS contrast-assistance features aim for.

## What changes under high contrast

- **Text and backgrounds** go to near-black-on-white (light scheme) or
  near-white-on-black (dark scheme), far exceeding the app's normal contrast.
- **Borders and dividers** become clearly visible solid lines wherever the
  normal theme relied on a subtle shadow or a soft colour difference.
- **The focus ring** — the outline that shows which control is selected
  while navigating by keyboard — gets thicker and guaranteed to stand out
  against any background.
- **Category colour-coding** in the question palette and canvas (the small
  coloured chip on each question type) keeps its colour but drops its tinted
  background fill in favour of a border — the same "less fill, more outline"
  shift Windows and macOS contrast themes make system-wide.
- **Shadows and drop-shadows** flatten into hard-edged lines rather than soft
  blurs.
- Your chosen **accent colour is preserved** — picking, say, amber still
  gives you an amber-flavoured app under high contrast — but the exact shade
  used shifts to whichever step of that colour clears the contrast
  requirement. At the strictest end this can mute the colour's usual
  vibrancy (amber reads more brown than gold, for example); this is an
  inherent trade-off of meeting the higher contrast bar, not a bug.

Nothing about layout, spacing, or the app's functionality changes — only
colour, border, and shadow treatment.

## Turning it on

Open **Settings → Appearance**. Alongside the existing colour-scheme control
there's a **Contrast** selector with three options:

- **Follow system** (the default) — Form Forge asks your operating system
  whether you've turned on a contrast-assistance setting (macOS "Increase
  contrast", Windows contrast themes, or your browser's own contrast
  preference) and matches it automatically. If you've never touched an OS
  contrast setting, this behaves exactly like **Normal**.
- **Normal** — the standard theme, regardless of any OS setting.
- **High** — always on, regardless of the OS setting.

The choice is saved on this device (alongside your colour scheme and accent)
and is carried in a whole-workspace backup's `preferences.json`, the same way
theme and accent are — restoring a backup on a new device restores your
contrast preference too.

High contrast combines with light, dark, and every accent colour — so
"dark + high contrast" and "light + high contrast" are both available, each
its own black-on-white or white-on-black-style pairing, matching how
Windows and macOS ship both a light and a dark contrast theme.

## The live preview is re-contrasted too

Form Forge's live preview renders your form with the real ODK Web Forms
engine so you see close to what an enumerator sees in ODK Collect. High
contrast **also** applies to that preview, for the same reason dark mode
does: seeing the actual appearance you're testing for is more useful while
building the form than a preview that silently stays in the normal theme
would be.

**Trade-off to be aware of:** most people filling in your form in ODK
Collect or ODK Web Forms will not have high contrast turned on — that is an
accessibility feature for people who need it, not the default rendering.
While you're previewing with contrast switched on, what you see is
deliberately **not** the typical respondent's experience; switch contrast
back to Normal (or Follow system, if your OS isn't set to high contrast) to
check the form's ordinary appearance.

## If your operating system uses "forced colors" / Windows Contrast Themes

Windows' own contrast themes work differently from the setting above: rather
than letting an app choose its own high-contrast colours, the operating
system replaces the browser's colours outright with your chosen palette.
Form Forge is built to stay usable in that mode too — focus indicators and
custom control boundaries are checked to remain visible — but this is a
compatibility pass against a platform feature Form Forge doesn't control,
not the app's own **High** contrast setting described above. The two can be
used independently: Form Forge's contrast setting works the same whether or
not your OS is separately forcing its own colours.

## Manual test scenarios (browser verification pass)

For the `/agent-browser` verification pass logged to
`docs/verification/2026-07-16-high-contrast-mode/`:

1. **Discoverability.** Open Settings → Appearance. Confirm a "Contrast"
   control appears next to the existing colour-scheme control, defaulted to
   "Follow system", with three options.
2. **Four render states.** For each of light/dark × normal/high (set
   Contrast to High, then toggle the scheme control through its three
   states, screenshotting each), confirm: body text reads solidly against
   its background, borders around cards/panels are clearly visible lines,
   and nothing looks "washed out" the way the normal theme's subtler
   surfaces do.
3. **No flash on reload.** With High selected, reload the app. The page
   should never show a frame of normal-contrast chrome before the
   high-contrast attribute applies (mirrors the existing dark-mode no-flash
   check).
4. **Persistence.** Reload and confirm the Contrast selection survived; open
   Settings again and confirm the control still shows "High".
5. **Category chips.** Open the question palette / a form's canvas under
   High. Confirm each question-type's category indicator now reads as an
   outlined chip rather than a soft tinted fill, and remains visually
   distinct between categories.
6. **Focus visibility.** Tab through the canvas and through Settings under
   High. Confirm the focus outline is clearly thicker/more visible than
   under Normal contrast.
7. **Accent interaction.** With an accent colour other than the default
   selected, switch Contrast to High and confirm the accent's hue is still
   recognizably present (even if muted) in buttons/links/focus rings —
   not replaced by a generic colour.
8. **Preview re-contrasting.** Open the live preview of a form with a few
   question types while High is active. Confirm the preview's colours match
   the chrome's high-contrast treatment, not the normal theme.
9. **Embed mode.** Open `/embed-demo.html`, use its Contrast control to send
   `contrast: 'high'` via `set-config`, and confirm the embedded builder
   switches live.
10. **Forced-colors emulation.** With DevTools' `forced-colors: active`
    rendering emulation turned on (a stand-in for Windows Contrast Themes),
    open the editor, Settings, and a mounted preview. Confirm: a focused
    control always shows a visible outline; the accent swatches and category
    chips still show their real colour (not replaced with the forced
    palette) since their whole purpose is showing that colour; nothing
    becomes invisible or inoperable. File anything that looks broken as a
    follow-up.
