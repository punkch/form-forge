# PWA Packaging — Manual Verification

These checks need a real Chrome and (for the update flow) two successive
deploys, so they are manual. Serve a production build first:

```sh
pnpm build && pnpm preview   # http://localhost:4173
```

(For a staged redeploy you will rebuild between steps — see #7.)

| # | Steps | Expected |
|---|---|---|
| 1 | Open http://localhost:4173 in Chrome, DevTools → Application → Manifest | Name "ODK Form Builder", theme `#3e9fcc`, standalone, 4 icons incl. maskable; no installability warnings |
| 2 | DevTools → Application → Service workers | `sw.js` activated and running; Cache Storage shows a `workbox-precache-…` cache with ~91 entries incl. the `odk-web-forms-*.js` chunk and Roboto `.woff2` files |
| 3 | Chrome address bar → Install icon ("Install ODK Form Builder") | App installs and opens in its own standalone window with the FB icon |
| 4 | DevTools → Lighthouse → run the PWA-relevant audits (Best practices; in older Chrome versions the dedicated "Progressive Web App" category) | Installability and service-worker checks pass |
| 5 | Create a form, add a question, then DevTools → Network → Offline (or airplane mode) and reload | Library loads, the form is there; open it, open the preview → the engine renders offline |
| 6 | Still with the app open in the library, create+save a form, then check the library footer | Footer shows `ODK Form Builder v<version>` and either "Storage: persistent" (once granted) or the dismissible "export a workspace backup" hint whose link downloads an archive; the dismiss X hides it across reloads |
| 7 | **Staged redeploy — toast path**: open the editor, type in a label and *keep typing* (autosave unsettled); in another terminal change any source string, `pnpm build` again, then wait ≤1 h or trigger `registration.update()` from DevTools | Sticky "New version ready — Reload" toast at top-center; clicking Reload applies the update; alternatively navigating back to the library applies it automatically |
| 8 | **Staged redeploy — silent path**: stay in the library (or let autosave settle in the editor) and repeat the redeploy of #7 | The app reloads itself into the new version without a prompt; no work lost |
| 9 | `BASE_PATH=/odk-builder/ pnpm build` and serve `dist/` under `/odk-builder/` | App, manifest (`start_url: '.'`) and SW all work under the prefix |

Automated coverage: `tests/e2e/pwa.spec.ts` (offline shell + offline
engine preview, chromium), `tests/unit/pwa-update-policy.spec.ts`,
`tests/unit/pwa-persistent-storage.spec.ts`.

Notes:

- Update checks happen on every page load and hourly in long sessions.
- The e2e/preview build made by Playwright sets `VITE_E2E=1`; in that
  build the service worker registers only when the URL contains `?pwa=1`.
  A plain `pnpm build` registers unconditionally.
