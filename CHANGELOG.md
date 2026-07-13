# Changelog

## [1.0.0-RC2](https://github.com/punkch/form-forge/compare/form-forge-v1.0.0-RC1...form-forge-v1.0.0-RC2) (2026-07-13)


### Features

* **editor:** two-line labels, named logic badges, always-labeled header ([0c1eda5](https://github.com/punkch/form-forge/commit/0c1eda5d63ad61e321f60f818218816d89bee53c))
* **help:** workflow guides, contextual triggers and first-use callouts ([9d93e75](https://github.com/punkch/form-forge/commit/9d93e75d99ff010376bebd94dc6d7bdaa57a886a))
* **library:** richer form cards and a New-form create hint ([716c834](https://github.com/punkch/form-forge/commit/716c8345491e67a59926fb6146eb6d37c467d419))
* **logic:** make the visual condition builder trustworthy ([c34a08e](https://github.com/punkch/form-forge/commit/c34a08e4ee220c92be927eb71401de52f31950be))
* **problems:** location chips, grouping, Ready state and export readiness ([81e5529](https://github.com/punkch/form-forge/commit/81e55291327ef8735388a11f0e7414fa69322ab6))
* **settings:** routed settings page behind a library gear ([1f54328](https://github.com/punkch/form-forge/commit/1f54328d6e5aa67fe05b6b58d5318bd147a39fc4))
* **translations:** full site coverage in the grid and explicit per-language panel editing ([6a68a83](https://github.com/punkch/form-forge/commit/6a68a834d6d965d792cd38ecdf48f5313ca4c4b8))


### Bug Fixes

* **canvas:** full-width wrapping titles and jump-free footer actions on question cards ([a87be3d](https://github.com/punkch/form-forge/commit/a87be3d93ec3cf0af1a0dc504f092039835c08c1))
* **preview:** range without bounds no longer crashes the live preview ([3c7dadc](https://github.com/punkch/form-forge/commit/3c7dadc17205740bb5e56b01b2c0ca95bcd1f2ca))


### Code Refactoring

* **help:** one help surface — the drawer gains a searchable list mode ([e3536bb](https://github.com/punkch/form-forge/commit/e3536bbb8dfc9da5bc2b9789bba36924f6270293))


### Documentation

* spec, verification log and index updates for the UI critique fixes ([5fca94c](https://github.com/punkch/form-forge/commit/5fca94cafd5bd00b077a633fb86399cd6d60ec42))


### Continuous Integration

* add self-hosted Renovate dependency updates ([59fd606](https://github.com/punkch/form-forge/commit/59fd6067f12ff030d069168a723bf69a14baaffc))
* keep RC prerelease numbering until 1.0.0 ships ([d63c486](https://github.com/punkch/form-forge/commit/d63c48611b1d120dfca2ec8947b74ffd6f9ac1e1))
* pass --repo to gh when dispatching deploy from release-please ([458b23f](https://github.com/punkch/form-forge/commit/458b23fa04a1354d737e4cbf02a3965a8f4c05cf))

## [1.0.0-RC1](https://github.com/punkch/form-forge/compare/form-forge-v1.0.0-RC1...form-forge-v1.0.0-RC1) (2026-07-10)


### Features

* adaptive resizable editor layout ([98d7cf9](https://github.com/punkch/form-forge/commit/98d7cf920f765dae1260635f90564e44a5a16c68))
* canvas and palette polish — category chips, reveal-on-add, designed empty state ([7f5e69a](https://github.com/punkch/form-forge/commit/7f5e69aaf76ea376b0162dcb158aec05c139e737))
* dataset tooling — column-aware parameters and file preview ([6819aea](https://github.com/punkch/form-forge/commit/6819aea1639fcb09261fd660ebd8489664485b08))
* entities update flows, save_to editor, and follow-up wizard ([b114b20](https://github.com/punkch/form-forge/commit/b114b20552df5dc43a067c31f6532947b6cafe3d))
* iframe embed mode with postMessage load/save API ([4db24e3](https://github.com/punkch/form-forge/commit/4db24e36377cd4ec4eb0ad9f968e0b6c55bdf8c0))
* in-app help — field popovers, question-type drawer, searchable reference ([cb52af6](https://github.com/punkch/form-forge/commit/cb52af618426caeaf751f595a70a8702f8ff182c))
* installable offline PWA with hybrid self-update ([f398826](https://github.com/punkch/form-forge/commit/f3988267443d2d2ea9c1abaae3414d96235d0b8e))
* ODK Form Builder — Phase 1 MVP ([94ff3d1](https://github.com/punkch/form-forge/commit/94ff3d128528334973b378f17bcb2ee123176c8f))
* preview toolbar with device presets, error containment, empty-group gating ([1b0669e](https://github.com/punkch/form-forge/commit/1b0669e4488804679b0fa0110eec13c85a1e77f0))
* properties panel restructure — collapsible sections, header name, choices grid + drag reorder ([2d75e79](https://github.com/punkch/form-forge/commit/2d75e790b9037d7942039db52b47bc19880aa35d))
* rebrand to Form Forge for ODK ([fe5a26d](https://github.com/punkch/form-forge/commit/fe5a26dfef8b525623f68a483b374bed140c1806))
* starter template gallery and save-as-template ([da39f5c](https://github.com/punkch/form-forge/commit/da39f5c37ee5c09474353f1e3194fd3184448cac))
* UI internationalization foundation — typed English catalog, RTL-ready ([86114fd](https://github.com/punkch/form-forge/commit/86114fdebb7fe396ae26e4e817f19659559150d4))
* upload choices files straight from the question panel ([ff425a7](https://github.com/punkch/form-forge/commit/ff425a7cc6ac78fbb01077ab5e8d47f60700eb06))
* visual logic builder for relevance and constraints ([8482c82](https://github.com/punkch/form-forge/commit/8482c82d3a982587caf06d9b54e5e05e6a5a5b2d))
* workspace export/import archives (.odkbuilder.zip) ([52b42cc](https://github.com/punkch/form-forge/commit/52b42ccc53ff65945f6280c3c6ef6df23fcb27d2))


### Bug Fixes

* hover on dropdown options triggers the option help ([703562a](https://github.com/punkch/form-forge/commit/703562aa93d14c8b8dbbace553cb08f32a0c6c74))
* palette auto-tuck measures against panel minimums; docs: after screenshots ([7ae3725](https://github.com/punkch/form-forge/commit/7ae3725f9e51f77c377f9b8a368088adcbc03c9a))
* preview no longer shows the previously opened form after switching ([866dc5c](https://github.com/punkch/form-forge/commit/866dc5cd1faf3a4ff80242e108009bc9b29c473c))
* some deprecated xlsx field types ([02978fa](https://github.com/punkch/form-forge/commit/02978faf01dc26de37af866242c763ab20c7c8e5))


### Documentation

* backlog shaping for Renovate dependency updates via GitHub Actions ([0b1a928](https://github.com/punkch/form-forge/commit/0b1a928a65301f4ff7b67684776ed9388909704a))
* feature checklist README and CLAUDE.md repository index ([6c2561d](https://github.com/punkch/form-forge/commit/6c2561d2e66b98009874c0b4f1592e74a051d187))
* phase 2 delivered — roadmap, backlog status, release guide; version to 1.0.0-dev ([b5efc95](https://github.com/punkch/form-forge/commit/b5efc955f399520c0a163cccd9649ba1d4871791))
* prune delivered shaping docs from the backlog ([afbe608](https://github.com/punkch/form-forge/commit/afbe608fa539445480de2db2db970725ac7b1323))
* save UX/layout overhaul spec (review findings, decisions, plan) ([681205d](https://github.com/punkch/form-forge/commit/681205d0c0ec84355918701b2ecf8ac72d9e901f))
* schedule phase 2 backlog — add embed API, UI i18n, CI/CD, in-app help shaping; amend dataset tooling + PWA self-update ([95c8b4e](https://github.com/punkch/form-forge/commit/95c8b4e8f97ccbc742b9192da86b04dbfedcf824))


### Continuous Integration

* add CI workflow (lint/typecheck/test + e2e) and composite setup action ([d71472f](https://github.com/punkch/form-forge/commit/d71472f41fe243a698f74155c45ec68579400b42))
* dispatch Pages deploy from release-please ([12ded95](https://github.com/punkch/form-forge/commit/12ded95bc025adf88e062253f5522c152f5b1547))
* mark RC/prerelease versions as GitHub prereleases ([b5d8bd4](https://github.com/punkch/form-forge/commit/b5d8bd445779cc88b6be81a936169cf7d28f0af5))
* release-please and GitHub Pages deploy on release ([4589c3e](https://github.com/punkch/form-forge/commit/4589c3e0056d7e45cf5c7ade34f96e2c59bee68e))

## 1.0.0-RC1 (2026-07-10)


### Features

* adaptive resizable editor layout ([98d7cf9](https://github.com/punkch/odk-form-builder/commit/98d7cf920f765dae1260635f90564e44a5a16c68))
* canvas and palette polish — category chips, reveal-on-add, designed empty state ([7f5e69a](https://github.com/punkch/odk-form-builder/commit/7f5e69aaf76ea376b0162dcb158aec05c139e737))
* dataset tooling — column-aware parameters and file preview ([6819aea](https://github.com/punkch/odk-form-builder/commit/6819aea1639fcb09261fd660ebd8489664485b08))
* entities update flows, save_to editor, and follow-up wizard ([b114b20](https://github.com/punkch/odk-form-builder/commit/b114b20552df5dc43a067c31f6532947b6cafe3d))
* iframe embed mode with postMessage load/save API ([4db24e3](https://github.com/punkch/odk-form-builder/commit/4db24e36377cd4ec4eb0ad9f968e0b6c55bdf8c0))
* in-app help — field popovers, question-type drawer, searchable reference ([cb52af6](https://github.com/punkch/odk-form-builder/commit/cb52af618426caeaf751f595a70a8702f8ff182c))
* installable offline PWA with hybrid self-update ([f398826](https://github.com/punkch/odk-form-builder/commit/f3988267443d2d2ea9c1abaae3414d96235d0b8e))
* ODK Form Builder — Phase 1 MVP ([94ff3d1](https://github.com/punkch/odk-form-builder/commit/94ff3d128528334973b378f17bcb2ee123176c8f))
* preview toolbar with device presets, error containment, empty-group gating ([1b0669e](https://github.com/punkch/odk-form-builder/commit/1b0669e4488804679b0fa0110eec13c85a1e77f0))
* properties panel restructure — collapsible sections, header name, choices grid + drag reorder ([2d75e79](https://github.com/punkch/odk-form-builder/commit/2d75e790b9037d7942039db52b47bc19880aa35d))
* starter template gallery and save-as-template ([da39f5c](https://github.com/punkch/odk-form-builder/commit/da39f5c37ee5c09474353f1e3194fd3184448cac))
* UI internationalization foundation — typed English catalog, RTL-ready ([86114fd](https://github.com/punkch/odk-form-builder/commit/86114fdebb7fe396ae26e4e817f19659559150d4))
* upload choices files straight from the question panel ([ff425a7](https://github.com/punkch/odk-form-builder/commit/ff425a7cc6ac78fbb01077ab5e8d47f60700eb06))
* visual logic builder for relevance and constraints ([8482c82](https://github.com/punkch/odk-form-builder/commit/8482c82d3a982587caf06d9b54e5e05e6a5a5b2d))
* workspace export/import archives (.odkbuilder.zip) ([52b42cc](https://github.com/punkch/odk-form-builder/commit/52b42ccc53ff65945f6280c3c6ef6df23fcb27d2))


### Bug Fixes

* palette auto-tuck measures against panel minimums; docs: after screenshots ([7ae3725](https://github.com/punkch/odk-form-builder/commit/7ae3725f9e51f77c377f9b8a368088adcbc03c9a))
* preview no longer shows the previously opened form after switching ([866dc5c](https://github.com/punkch/odk-form-builder/commit/866dc5cd1faf3a4ff80242e108009bc9b29c473c))


### Documentation

* backlog shaping for Renovate dependency updates via GitHub Actions ([0b1a928](https://github.com/punkch/odk-form-builder/commit/0b1a928a65301f4ff7b67684776ed9388909704a))
* feature checklist README and CLAUDE.md repository index ([6c2561d](https://github.com/punkch/odk-form-builder/commit/6c2561d2e66b98009874c0b4f1592e74a051d187))
* phase 2 delivered — roadmap, backlog status, release guide; version to 1.0.0-dev ([b5efc95](https://github.com/punkch/odk-form-builder/commit/b5efc955f399520c0a163cccd9649ba1d4871791))
* prune delivered shaping docs from the backlog ([afbe608](https://github.com/punkch/odk-form-builder/commit/afbe608fa539445480de2db2db970725ac7b1323))
* save UX/layout overhaul spec (review findings, decisions, plan) ([681205d](https://github.com/punkch/odk-form-builder/commit/681205d0c0ec84355918701b2ecf8ac72d9e901f))
* schedule phase 2 backlog — add embed API, UI i18n, CI/CD, in-app help shaping; amend dataset tooling + PWA self-update ([95c8b4e](https://github.com/punkch/odk-form-builder/commit/95c8b4e8f97ccbc742b9192da86b04dbfedcf824))


### Continuous Integration

* add CI workflow (lint/typecheck/test + e2e) and composite setup action ([d71472f](https://github.com/punkch/odk-form-builder/commit/d71472f41fe243a698f74155c45ec68579400b42))
* mark RC/prerelease versions as GitHub prereleases ([b5d8bd4](https://github.com/punkch/odk-form-builder/commit/b5d8bd445779cc88b6be81a936169cf7d28f0af5))
* release-please and GitHub Pages deploy on release ([4589c3e](https://github.com/punkch/odk-form-builder/commit/4589c3e0056d7e45cf5c7ade34f96e2c59bee68e))
