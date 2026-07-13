#!/usr/bin/env bash
# Local Caddy CORS proxy for ODK Central — implements "Recipe 3" from
# docs/specs/2026-07-13-1331-central-publishing/user-guide.md, for when you
# cannot add CORS headers on the Central server itself.
#
# Downloads a stock Caddy binary (Apache-2.0, single static file) into .local/
# (gitignored) and creates or updates .local/Caddyfile. Register
# http://localhost:<port>/<prefix> as the server URL in Form Forge; Caddy
# forwards /<prefix>/* to the real Central and answers the preflights.
#
# An existing Caddyfile is updated in place: the requested prefix is added (or
# its upstream corrected) and every other prefix is preserved — run once per
# Central server to build up a multi-server proxy. A running proxy is reloaded
# automatically.
#
# Usage:
#   scripts/central-cors-proxy.sh [options]
#     -u <url>     upstream Central base URL
#                  (default: $CENTRAL_PROXY_UPSTREAM, else https://my-central-server.example.com)
#     -n <prefix>  path prefix for this upstream
#                  (default: $CENTRAL_PROXY_PREFIX, else my-central)
#     -o <origin>  builder origin to allow, generation-time only
#                  (default: $CENTRAL_PROXY_ORIGIN, else http://localhost:5173)
#     -p <port>    local port to listen on, generation-time only
#                  (default: $CENTRAL_PROXY_PORT, else 8123)
#     -f           regenerate the Caddyfile from scratch and re-download Caddy
#     -h           show this help
#
# Then run the proxy with:
#   .local/caddy run --config .local/Caddyfile
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="$ROOT/.local"
CADDY="$LOCAL_DIR/caddy"
CADDYFILE="$LOCAL_DIR/Caddyfile"

UPSTREAM="${CENTRAL_PROXY_UPSTREAM:-https://my-central-server.example.com}"
ORIGIN="${CENTRAL_PROXY_ORIGIN:-http://localhost:5173}"
PORT="${CENTRAL_PROXY_PORT:-8123}"
PREFIX="${CENTRAL_PROXY_PREFIX:-my-central}"
FORCE=0

while getopts 'u:o:p:n:fh' opt; do
  case "$opt" in
    u) UPSTREAM="$OPTARG" ;;
    o) ORIGIN="$OPTARG" ;;
    p) PORT="$OPTARG" ;;
    n) PREFIX="$OPTARG" ;;
    f) FORCE=1 ;;
    h) awk 'NR > 1 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) exit 2 ;;
  esac
done

UPSTREAM="${UPSTREAM%/}"
PREFIX="${PREFIX#/}"; PREFIX="${PREFIX%/}"

mkdir -p "$LOCAL_DIR"

# --- 1. Fetch Caddy (official build server serves the bare binary) ----------
if [[ ! -x "$CADDY" || "$FORCE" -eq 1 ]]; then
  case "$(uname -s)" in
    Linux)  os="linux" ;;
    Darwin) os="darwin" ;;
    *) echo "error: unsupported OS $(uname -s) (linux/darwin only)" >&2; exit 1 ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64)  arch="amd64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) echo "error: unsupported arch $(uname -m) (amd64/arm64 only)" >&2; exit 1 ;;
  esac
  echo "Downloading Caddy (${os}/${arch}) into .local/ ..."
  curl -fL --progress-bar "https://caddyserver.com/api/download?os=${os}&arch=${arch}" -o "$CADDY.tmp"
  mv "$CADDY.tmp" "$CADDY"
  chmod +x "$CADDY"
fi
echo "Caddy: $("$CADDY" version)"

# --- 2. Create or update the Caddyfile (user-guide Recipe 3) -----------------
generate_caddyfile() {
  cat > "$CADDYFILE" <<EOF
# CORS proxy for ODK Central - managed by scripts/central-cors-proxy.{sh,ps1}.
# Recipe 3 of docs/specs/2026-07-13-1331-central-publishing/user-guide.md.
#
# One handle_path block per Central server; register each as
# http://localhost:${PORT}/<prefix> in Form Forge. Re-run the script with
# -n <prefix> -u <url> to add or update a server.
{
	auto_https off
}

:${PORT} {
	@preflight method OPTIONS
	handle @preflight {
		header Access-Control-Allow-Origin "${ORIGIN}"
		header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
		header Access-Control-Allow-Headers "Authorization, Content-Type"
		header Access-Control-Max-Age "3600"
		header Access-Control-Allow-Private-Network "true"
		respond 204
	}

	header Access-Control-Allow-Origin "${ORIGIN}"
	header Access-Control-Expose-Headers "ETag"

	# header_up Host is mandatory: a forwarded Host: localhost:${PORT} gets
	# 404-routed before reaching Central's API.
	handle_path /${PREFIX}/* {
		reverse_proxy ${UPSTREAM} {
			header_up Host {upstream_hostport}
		}
	}

	# Fail loudly when no prefix matches (e.g. a stale server URL registered
	# in Form Forge) instead of Caddy's default empty 200.
	handle {
		respond "No proxy prefix matches this path; check the server URL registered in Form Forge against this Caddyfile." 404
	}
}
EOF
  echo "Wrote $CADDYFILE (/${PREFIX} -> ${UPSTREAM}, origin: ${ORIGIN}, port: ${PORT})."
}

current_upstream_for_prefix() {
  awk -v p="$PREFIX" '
    index($0, "handle_path /" p "/*") > 0 { f = 1 }
    f && index($0, "reverse_proxy ") > 0 { print $2; exit }' "$CADDYFILE"
}

update_prefix_upstream() {
  local tmp="$CADDYFILE.tmp"
  awk -v p="$PREFIX" -v u="$UPSTREAM" '
    index($0, "handle_path /" p "/*") > 0 { inblock = 1 }
    inblock && index($0, "reverse_proxy ") > 0 {
      printf "\t\treverse_proxy %s {\n", u
      inblock = 0
      next
    }
    { print }' "$CADDYFILE" > "$tmp"
  mv "$tmp" "$CADDYFILE"
}

append_prefix_block() {
  # New blocks go just above the 404 fallback (or the final closing brace when
  # a hand-edited file dropped the fallback).
  local tmp="$CADDYFILE.tmp"
  awk -v p="$PREFIX" -v u="$UPSTREAM" '
    { lines[NR] = $0
      if (!mark && index($0, "# Fail loudly") > 0) mark = NR
      if ($0 == "}") lastbrace = NR }
    END {
      pos = mark ? mark : lastbrace
      for (i = 1; i <= NR; i++) {
        if (i == pos) {
          printf "\thandle_path /%s/* {\n", p
          printf "\t\treverse_proxy %s {\n", u
          printf "\t\t\theader_up Host {upstream_hostport}\n"
          printf "\t\t}\n\t}\n\n"
        }
        print lines[i]
      }
    }' "$CADDYFILE" > "$tmp"
  mv "$tmp" "$CADDYFILE"
}

if [[ ! -f "$CADDYFILE" || "$FORCE" -eq 1 ]]; then
  generate_caddyfile
else
  existing_port="$(sed -n 's/^:\([0-9][0-9]*\) {$/\1/p' "$CADDYFILE" | head -n1)"
  if [[ -n "$existing_port" && "$existing_port" != "$PORT" ]]; then
    echo "note: keeping the existing port :${existing_port} (-p only applies at generation; use -f to regenerate)."
    PORT="$existing_port"
  fi
  existing_upstream="$(current_upstream_for_prefix)"
  if [[ -z "$existing_upstream" ]]; then
    append_prefix_block
    echo "Added /${PREFIX} -> ${UPSTREAM} to $CADDYFILE."
  elif [[ "$existing_upstream" != "$UPSTREAM" ]]; then
    update_prefix_upstream
    echo "Updated /${PREFIX}: ${existing_upstream} -> ${UPSTREAM}."
  else
    echo "/${PREFIX} -> ${UPSTREAM} already configured; Caddyfile unchanged."
  fi
fi

if ! validation="$("$CADDY" validate --config "$CADDYFILE" 2>&1)"; then
  echo "$validation" >&2
  echo "error: Caddyfile failed to validate" >&2
  exit 1
fi
echo "Caddyfile validates."

if "$CADDY" reload --config "$CADDYFILE" > /dev/null 2>&1; then
  echo "Live proxy reloaded."
else
  echo "Proxy not running — start it with: .local/caddy run --config .local/Caddyfile"
fi

echo
echo "Configured routes (register these as server URLs in Form Forge):"
awk -v port="$PORT" '
  index($0, "handle_path /") > 0 { pfx = $2; sub(/^\//, "", pfx); sub(/\/\*$/, "", pfx) }
  pfx != "" && index($0, "reverse_proxy ") > 0 {
    print "  http://localhost:" port "/" pfx "  ->  " $2
    pfx = ""
  }' "$CADDYFILE"
