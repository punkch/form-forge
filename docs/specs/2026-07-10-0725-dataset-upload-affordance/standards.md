# Standards — Dataset Upload from the Property Panel

Follows the existing project standards documented in
`docs/specs/2026-07-09-1602-product-docs-and-foundation/standards.md`
(strict TypeScript, neostandard ESLint, Composition API `<script setup>`,
Vitest + Playwright patterns) and the i18n conventions from
`docs/specs/2026-07-09-2352-ui-i18n-foundation/` (all UI strings through
`t()` with keys in the namespace JSON; `translate` for non-component code).

One convention worth noting for future attachment features: **uploads that
must update the document and store a blob go through
`useAttachmentUpload().attachFile()`**, so ref replacement, role
classification, undo grouping and superseded-record cleanup stay in one
place. Direct `attachmentsRepo.addAttachment` + hand-rolled `form.mutate`
in components is now considered a smell.
