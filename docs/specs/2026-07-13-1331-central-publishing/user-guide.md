# User Guide — ODK Central integration (publish + import)

> **Status:** the end-user walkthrough sections below are a placeholder to be
> completed during delivery (final testids/labels/screenshots). The
> **self-hoster CORS setup** section is complete and load-bearing — it is the
> documented server-side requirement the CORS spike produced, and users are
> linked to it from the app's "connection blocked" error.

Form Forge is a browser-only builder — nothing leaves your device unless you
explicitly publish or import. ODK Central integration is **off until you add a
server**. Once added, you can publish a form's draft to a Central project and
import a published form back into your library. All connections are manual;
there is no background sync and no telemetry.

## Adding a server (App Settings)

*(Walkthrough placeholder — complete at delivery.)*

1. Open **Settings** (gear on the Forms library) → **ODK Central servers**.
2. **Add server**: a display name and the base URL (see URL rules below), and
   optionally your email + password to store.
3. The first time you save a password or connect, Form Forge asks you to
   **create a vault passphrase** (once) or **unlock** it (each session).

### Base URL rules

- Use `https://` for any real server. Plain `http://` is accepted **only** for
  loopback hosts (`localhost` / `127.0.0.1`), for the local-proxy setups below.
- The base URL is treated as opaque, **including any path prefix**
  (`http://localhost:8123/my-central`), so every proxy shape below works
  unchanged.

## The credential vault

*(Walkthrough placeholder — complete at delivery.)*

- One **passphrase** protects all stored server passwords. It is asked for on
  the first Central action of a session (create on first-ever use, unlock
  thereafter).
- Passwords are encrypted at rest (non-extractable AES-GCM, key derived from
  your passphrase). Session tokens and the key live in memory only;
  **Disconnect** or **Lock vault** wipes them.
- **What this protects:** stored passwords on a stolen/shared device and against
  casual browser-storage inspection. **What it does not:** code running in an
  already-unlocked page. Honest by design.
- **Forgotten passphrase:** there is no recovery. **Reset** wipes stored
  passwords (your server records survive) and you re-enter passwords under a new
  passphrase.
- **"Wrong passphrase" you're sure is right:** authenticated encryption
  (AES-GCM) cannot distinguish a wrong passphrase from vault data corrupted in
  browser storage — both fail the same check. If the correct passphrase is
  repeatedly rejected, the vault data is damaged; Reset is the way out.

## Publishing a draft

*(Walkthrough placeholder — complete at delivery.)*

- **Publish** (editor toolbar, next to Export) opens pre-filled with the form's
  most recent destination; other known destinations are one-click re-deploys.
- Pick a project, choose **new form** or **update existing** (matched by form
  ID), then publish. Central's validation warnings are shown verbatim.
- If Central rejects the version as already-used, Form Forge offers to **bump
  the version** and retry.
- If the form ID no longer matches the chosen destination (you renamed it),
  Form Forge warns that publishing creates a **new** form there.
- Publishing to live (from draft) is done in Central's own UI — review happens
  there.

## Importing from Central

*(Walkthrough placeholder — complete at delivery.)*

- **Import form → From Central**: pick server → project → form (only *published*
  forms are listed), then import. The definition and all attachments come across
  and the form opens in the editor, previewable immediately.
- If a form with the same form ID already exists in your library, you choose
  **copy** (new form, non-destructive) or **replace** (overwrites the existing
  form — confirmed, destructive).
- An import remembers where the form came from, so a later **Publish** pre-fills
  that destination.

---

## Self-hoster setup: making Central reachable from the builder (CORS)

Central's API does **not** send permissive CORS headers by default, so a browser
at a different origin cannot call it directly (a blocked request appears in the
app as "connection blocked — see setup"). CORS can only be relaxed on the
**server side** — there is no pure client-side workaround. Pick one recipe.
Everything below was validated end-to-end against a real Central
(central-backend v2024.3.1); **2024.3 is the minimum supported version**.

### Recipe 1 — CORS headers at Central's nginx (or any fronting proxy/LB)

Stock Central terminates TLS in its own nginx and proxies the API via a
`location ~ ^/v\d` block. Override that block (this also works verbatim at any
fronting proxy/LB, e.g. a cloud load balancer, leaving the Central install
untouched):

```nginx
location ~ ^/v\d {
  set $cors_origin "";
  # allowlist the builder's origin(s)
  if ($http_origin = "https://<builder-origin>") { set $cors_origin $http_origin; }

  if ($request_method = OPTIONS) {
    add_header Access-Control-Allow-Origin $cors_origin always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
    add_header Access-Control-Max-Age 3600 always;
    return 204;
  }
  add_header Access-Control-Allow-Origin $cors_origin always;
  add_header Access-Control-Expose-Headers "ETag" always;

  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_pass http://service:8383;
  proxy_redirect off;
  proxy_request_buffering on;
  proxy_buffering off;
  proxy_read_timeout 2m;
}
```

Notes: the client authenticates with a Bearer header (not cookies), so
`Access-Control-Allow-Credentials` is not needed; `Authorization` must be listed
explicitly in `Allow-Headers` (a `*` wildcard does not cover it).

### Recipe 2 — Same-origin (Fallback A, no CORS at all)

Serve the builder's static `dist/` from Central's own origin (it's just static
files, dropped behind Central's nginx). Same origin ⇒ no CORS. Cost: you manage
the static files yourself instead of using the hosted PWA's auto-updates. This
is also the shape the e2e tests exercise (mock server registered same-origin).

### Recipe 3 — Local Caddy proxy on the user's machine

Run stock [Caddy](https://caddyserver.com) (Apache-2.0, single static binary —
we ship documentation, not software) with this Caddyfile, then register
`http://localhost:8123/<prefix>` as the server URL in the builder:

```caddyfile
{
	auto_https off
}

:8123 {
	@preflight method OPTIONS
	handle @preflight {
		header Access-Control-Allow-Origin "https://<builder-origin>"
		header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
		header Access-Control-Allow-Headers "Authorization, Content-Type"
		header Access-Control-Max-Age "3600"
		header Access-Control-Allow-Private-Network "true"
		respond 204
	}

	header Access-Control-Allow-Origin "https://<builder-origin>"
	header Access-Control-Expose-Headers "ETag"

	# one block per registered Central server; add + `caddy reload`
	handle_path /my-central/* {
		reverse_proxy https://central.example.org {
			header_up Host {upstream_hostport}
		}
	}
}
```

Findings baked in:

- `header_up Host {upstream_hostport}` is **mandatory** — a forwarded
  `Host: localhost:8123` gets 404-routed before reaching Central's API.
- **Multi-server** = one static `handle_path` prefix per server on one port
  (least privilege: the proxy can only reach explicitly listed upstreams).
  Register each as `http://localhost:8123/<that-prefix>` in the builder. A
  cors-anywhere-style dynamic target-in-path proxy is deliberately rejected
  (open-relay shape, fragile SNI/Host wiring).
- An `https` page calling `http://localhost` is exempt from mixed-content
  blocking (Chrome + Firefox treat loopback as trustworthy); the
  `Allow-Private-Network` header covers Chrome's private-network opt-in.
- **Variant (fully same-origin):** Caddy can also `file_server` the builder's
  `dist/` and `reverse_proxy /v1/*` — no CORS at all, at the cost of the hosted
  PWA's auto-updates. This is Recipe 2 via Caddy.

### Not recommended

- **Public CORS proxies** — disqualified: your credentials and session tokens
  would transit third-party infrastructure. A proxy, if any, must be
  org-controlled (a ~20-line Cloudflare Worker or a tiny container forwarding
  `/v1/*` with the headers above).
- **npm CORS proxies** (`local-cors-proxy`, `cors-anywhere`) — effectively
  unmaintained; credentials shouldn't transit abandonware.

### Dev-time note (contributors)

For manual testing during `pnpm dev`, point Vite's `server.proxy` at `/v1` to a
real instance — same-origin during dev, so the full flow works with no server
changes. e2e never hits the network (Playwright route interception only).

---

## Manual test scenarios (for the verification pass)

1. **Add + unlock.** Add a server; the first save/connect prompts to create a
   passphrase; a subsequent session prompts to unlock; a wrong passphrase is
   rejected without decrypting anything.
2. **Import two-attachment form.** From Central → pick a published form with two
   attachments → import → both attachments present and previewable in the
   editor; the form ID collision path offers copy vs replace.
3. **Publish + targets.** Publish the imported form (dialog pre-filled with the
   source); publish it to a second server; confirm two one-click re-deploy
   targets appear; a version-conflict offers a bump; a renamed form ID warns of
   a new form.
4. **Disconnect / lock.** Disconnect wipes the "connected as…" indicator and
   token; Lock vault clears the key.
5. **Forgotten reset.** Reset wipes stored passwords, keeps server records.
6. **Export isolation.** While connected + unlocked, export the workspace and
   confirm the archive contains no server records or credential material.
7. **Embed.** In the embed demo host there is no settings route and no Central
   affordances.
8. **CORS UX.** Point at a server without the CORS recipe; confirm the app shows
   a distinct "connection blocked — see setup" message linking this guide, not a
   generic auth error.
