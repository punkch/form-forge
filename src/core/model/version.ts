/**
 * Form version stamps. `defaultVersion()` is the pyxform-style default a new or
 * templated form receives; `bumpVersion()` derives a fresh, guaranteed-distinct
 * version when a publish target already carries the current one (a Central 409
 * conflict). Both live here so the model factory and the publish flow share one
 * generator.
 */

/** pyxform-style default version: today's date-time as a yyyymmddHHMM string. */
export const defaultVersion = (): string => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`
}

/**
 * A new version string guaranteed distinct from `current`.
 *
 * The natural bump is a fresh timestamp, which differs from `current` whenever
 * a minute has elapsed. Within the same minute a fresh `defaultVersion()` would
 * collide, so a `-N` counter suffix is appended (or an existing one advanced) to
 * keep the result distinct and ordered after `current`. A suffixed version falls
 * outside the 12-digit timestamp format, so the library renders it raw — a
 * useful "manually bumped" signal.
 */
export const bumpVersion = (current?: string): string => {
  const candidate = defaultVersion()
  if (current === undefined || current === '') return candidate

  // Split off an existing "-N" counter suffix so repeated bumps advance it
  // rather than resetting.
  const suffixed = /^(.+)-(\d+)$/.exec(current)
  const base = suffixed ? suffixed[1] : current
  const counter = suffixed ? Number(suffixed[2]) : 1

  // A fresh timestamp that differs from current (and its base) is already the
  // natural, newer version — no suffix needed.
  if (candidate !== base && candidate !== current) return candidate

  // Same-minute regeneration: advance the counter so the result is distinct.
  return `${base}-${counter + 1}`
}
