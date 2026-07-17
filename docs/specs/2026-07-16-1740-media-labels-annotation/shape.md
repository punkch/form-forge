# Media labels & annotation — Shaping Notes

## Scope

Bring the two ODK image-in-design mechanisms into the builder's authoring surfaces:

1. **Label media** — XLSForm `media::image` / `media::big-image` / `media::audio` / `media::video` on the survey and choices sheets (per-language) → XForm itext `<value form="…">jr://…</value>`. The engine already round-trips all of it; the feature is the authoring UI (properties panel + per-choice) plus reference/validation completeness.
2. **Image annotation** — the `image` type's `annotate`/`draw`/`signature` appearances (already in the registry) and the annotate **template image via the `default` column**, which today is invisible to serialization parity, attachment detection, rename rewriting, and validation.

Plus golden-fixture coverage for both patterns.

## Decisions

- **All four media kinds** exposed in the authoring UI (image, big-image, audio, video) — the engine treats them uniformly; image is the headline.
- **Authoring from question properties AND per-choice rows**; the translations grid keeps its role as the per-language override editor (rows appear once a ref exists — unchanged gating).
- **Default becomes an attachment picker for all image questions**, not only annotate — pyxform 4.5.0 (probe-verified) prefixes `jr://images/` on any non-dynamic image-question default, idempotently and appearance-independently.
- **`defaultValue` is modeled as a bare filename**; the `jr://images/` prefix is applied at XForm-serialize time and stripped at parse time (in `finalizeQuestion`, where the question type resolves). Legacy prefixed values normalize on touch — no `migrateDoc` migration.
- **Reuse issue code `ref.missing-attachment`** with a new message string for missing default images; the three existing messages stay byte-stable.
- **Shared media across translations**: XForms itext has no cross-language media fallback (probe: an unsuffixed `media::image` column reaches only the default language and pyxform warns per missing language). The builder therefore **fans out at pick time** — one filename written to every current language in one undo step (Shape A: the `DEFAULT_LANG` sentinel; Shape B: every named language). Replace/clear rewrites only languages still holding the old filename, so deliberate overrides survive. The picker shows "varies by language" when values diverge. The file itself is stored once; all languages reference it by name.
- **New-language media pre-fill**: subsequent `addLanguage` calls copy each media slot's `settings.defaultLanguage` value into the new language (text stays empty — people rarely translate images). First-language add already migrates sentinel media via `mergeDefaultInto`.
- **Scope guard**: audio/video question *defaults* (as opposed to label media) are out of scope — pyxform prefix behavior unprobed; emission stays verbatim.
- Filenames containing `(`/`)` would classify as dynamic defaults (`isDynamicDefault` heuristic, shared with pyxform) — uploads sanitize via the existing stored-as rename-notice pattern.

## Decisions added during delivery (verification phase)

The two new goldens exposed a latent serializer bug and forced one revision of a prior spec's assumption:

- **Per-entry itext in monolingual forms** — the serializer used a document-wide `useItext` flag, so any media/guidance in a monolingual doc pushed EVERY label, hint and bind message into itext. pyxform (probe-verified) decides per entry: a label uses itext iff that label has media; a hint iff it has guidance; a used choice list iff any of its choices has media; bind messages stay plain attributes unless the form is multilingual. Fixed with the `labelUsesItext`/`hintUsesItext`/`listUsesItext` trio (multilingual docs still itext everything, pinned by the `translated` golden). `listsWithMedia` now also only counts **used** lists, matching pyxform's silence about unreferenced lists.
- **Solo `lang="default"` folds to the monolingual shape on parse** — pyxform serializes a monolingual form's forced itext as one `lang="default"` translation block. The parser previously kept `'default'` as a named language (a non-goal note in the 2026-07-16-1712 spec, decided without a golden covering this shape); that broke byte-identical round-trips and would have resurfaced the just-retired "default" pseudo-language for any imported monolingual form with media. Now: exactly one `lang="default"` block → `doc.languages` stays empty (values are already keyed under the sentinel); `'default'` **alongside named languages** still imports as a named language (the mixed-import case the 1712 decision actually addressed). Pinned by the `media_labels` golden round-trip.

## Context

- **Visuals:** None — follow existing panel patterns (itemset-file uploader, LocalizedInput); pixel-verify with agent-browser + interface-craft after implementation.
- **References:** see `references.md`.
- **Product alignment:** extends the delivered 2026-07-10-2006 translation-coverage spec (grid exposure of media rows, read-only-in-effect) and roadmap Phase-1 item 7 (attachments). Sequenced after — and reconciled with — commit `cf4d331` (`2026-07-16-1712-translations-default-language`): Shape A/Shape B language model, `settings.defaultLanguage`, sentinel merge on first language.
- **Execution:** dynamic Workflow with parallel agents; implementation agents on cheaper models (sonnet; haiku only for mechanical edits).

## Skills & Conventions Applied

See `standards.md`.
