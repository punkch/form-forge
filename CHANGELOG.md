# Changelog

## [1.0.1](https://github.com/punkch/form-forge/compare/form-forge-v1.0.0...form-forge-v1.0.1) (2026-07-23)


### Bug Fixes

* **a11y:** WCAG AA across themes, contrast modes and accents — clamp generator, ARIA fixes, axe audit tool + CI gate ([f07809b](https://github.com/punkch/form-forge/commit/f07809bc444459fd1d371ffa832d12bb190ca6d2))

## [1.0.0](https://github.com/punkch/form-forge/compare/form-forge-v1.0.0-RC3...form-forge-v1.0.0) (2026-07-23)


### Features

* **canvas:** multi-select with clipboard ops, canvas toolbar & insert-from-template ([dd57fdd](https://github.com/punkch/form-forge/commit/dd57fddf5be78daa413cb74b6c687639e51631de))


### Continuous Integration

* graduate release-please from prerelease (RC) to stable semver versioning ([8682d38](https://github.com/punkch/form-forge/commit/8682d382a013d0c9ff54e379a34f10345e056ae6))

## [1.0.0-RC3](https://github.com/punkch/form-forge/compare/form-forge-v1.0.0-RC2...form-forge-v1.0.0-RC3) (2026-07-20)


### Features

* **attachments:** drill-in preview replaces the modal swap ([5921127](https://github.com/punkch/form-forge/commit/59211279906b6ca9327270dfe49e1f6126ae3f58))
* **attachments:** eye-icon preview for image attachments ([f6093e3](https://github.com/punkch/form-forge/commit/f6093e37933c2406bb046dbbea2847c96ec57cb4))
* **attachments:** rename, per-row replace, and upload-conflict handling ([c5458c3](https://github.com/punkch/form-forge/commit/c5458c3bb9920400bf68b2ea09234bbf9bf2d8e2))
* **backup:** carry locally saved templates in the workspace backup ([6fe48c2](https://github.com/punkch/form-forge/commit/6fe48c298b87138bf42b38e623881011191d1664))
* **canvas:** animate list changes on canvas, choices and library ([fdad89f](https://github.com/punkch/form-forge/commit/fdad89f3bd0bca9f8426d3fcdc838ef67c99aa23))
* **central:** non-modal drawer + hub replacing publish/import modals ([ee81c04](https://github.com/punkch/form-forge/commit/ee81c04329c765cff6dbb462308946f33ef1c707))
* **core:** image defaults join the attachment traversal; per-entry itext parity ([d0ad943](https://github.com/punkch/form-forge/commit/d0ad943d0709132821f49e6b24e1d34bdc90e0fe))
* **editor:** animate drawers and panes, remount canvas per record ([58dab6c](https://github.com/punkch/form-forge/commit/58dab6ccab65baf5097e4548ade554f91746ad85))
* **editor:** regroup toolbar into labelled clusters, promote form tools out of the kebab ([1d1c750](https://github.com/punkch/form-forge/commit/1d1c750a2c7dde3e82b4df9c6f1c8f8fb460b914))
* **export:** remember the last export format per form ([ec3938b](https://github.com/punkch/form-forge/commit/ec3938b2ef30ca50ecc4a873f9e0ade2b2960461))
* **export:** split ZIP export into XForm and XLSForm attachment bundles ([586be21](https://github.com/punkch/form-forge/commit/586be21618fd9d085a677d07e6d76e61c3e99d3d))
* **help:** parameter-specific help popovers ([ded5c06](https://github.com/punkch/form-forge/commit/ded5c06bd10cd839dbe14c0cf9d75137a709a932))
* **i18n:** French and Spanish UI catalogs ([f75d34d](https://github.com/punkch/form-forge/commit/f75d34d9f66e552b536aad4450d1c06ba48d96cb))
* **import:** import per-form ZIP bundles with attachments ([27fa25f](https://github.com/punkch/form-forge/commit/27fa25f6fc7e568de32c47716f49af7525f80e7e))
* **library:** author credit line in the footer ([bf67a91](https://github.com/punkch/form-forge/commit/bf67a913acde5e2e590f74ed2d5eee154f06e516))
* **media:** label media authoring + default-image picker + choice media ([f8aa8db](https://github.com/punkch/form-forge/commit/f8aa8db1e16520f58f1d6bf0de420e6e4aeb5f1c))
* ODK Central integration ([16b9930](https://github.com/punkch/form-forge/commit/16b993071c3344ed1d31413fa14c9804fe6cde62))
* **preview:** follow canvas selection in the live preview ([47d5b9c](https://github.com/punkch/form-forge/commit/47d5b9c6cee677f7f822484a5075ee23967698ab))
* **shell:** animate route switches ([e73f25c](https://github.com/punkch/form-forge/commit/e73f25cbaedbd7424743ea8e99654a23e66c64ee))
* **shell:** merge form title into the Form menu button ([29f755f](https://github.com/punkch/form-forge/commit/29f755f98408fd515479a56d1712973e86652fb8))
* **shell:** micro-interaction motion polish ([2e75918](https://github.com/punkch/form-forge/commit/2e75918dd4a92e1967a81dac4a7b2b0db03aed45))
* **styles:** add motion tokens and global reduced-motion guard ([0cd2adc](https://github.com/punkch/form-forge/commit/0cd2adc02d78e6f9aec684185acbe54b42a43cf9))
* **styles:** add shared motion transitions and retune primevue overlays ([65b74ad](https://github.com/punkch/form-forge/commit/65b74adc00a717c855f425df9f6c9c4a73198c00))
* **templates:** manage saved templates and hide bundled starters ([2838ee4](https://github.com/punkch/form-forge/commit/2838ee481db327b612d3d2b84d7033e8d2dbc8f3))
* **templates:** polish the template and backup UX seams ([a6892b0](https://github.com/punkch/form-forge/commit/a6892b0da8602b231a912ad729a231193d8cd7ab))
* **theme:** add a high-contrast accessibility preference ([50cb57c](https://github.com/punkch/form-forge/commit/50cb57c3ae9788e4dff6dccfd44808ae71abad53))
* **theme:** light/dark/system colour scheme and accent presets ([e630d2f](https://github.com/punkch/form-forge/commit/e630d2f3fea458ce7db92338e332b71a9f303dca))
* **translations:** convert default text into the first named language ([cf4d331](https://github.com/punkch/form-forge/commit/cf4d3314f73e38d6d0f07f094fb1212811f3bc62))
* **translations:** hide hint rows behind a Show hints toggle ([3f82027](https://github.com/punkch/form-forge/commit/3f8202745becb27a769e9e5b8468f7d64794a64a))
* **workspace:** back up Central servers, targets & vault in whole-workspace export ([bb2ea9b](https://github.com/punkch/form-forge/commit/bb2ea9baa38122fb93b98fa8b1fbf3a69f151a81))


### Bug Fixes

* **a11y:** keep custom controls usable under forced-colors mode ([cbeab81](https://github.com/punkch/form-forge/commit/cbeab81a9e7c07a23332e905512263d8ea46d089))
* **attachments:** constant-size dialog body across list and preview ([b7fe63a](https://github.com/punkch/form-forge/commit/b7fe63a6d1cd4732f9951c20b77ad25e8563b044))
* **attachments:** stable dialog frame for the drill-in preview ([832654d](https://github.com/punkch/form-forge/commit/832654d8cd5f73866378a076fc28a4ceb339908e))
* **attachments:** stop same-name re-upload from poisoning saves ([5868e7d](https://github.com/punkch/form-forge/commit/5868e7d2ce084848f4f448ed956a96895dc98328))
* **central:** restore collapsed drawer spacing via --builder-spacing-xs ([6b7fdc8](https://github.com/punkch/form-forge/commit/6b7fdc8d9f9c77a69b8a30f651af9e18d87ddd15))
* **editor:** keep header controls rigid at narrow widths ([811af7b](https://github.com/punkch/form-forge/commit/811af7be3b2fc1ab7cd68793394e27856765467e))
* **editor:** swap the palette-toggle glyph to pi-th-large; log wave-1 verification passes ([786578b](https://github.com/punkch/form-forge/commit/786578b4e16bfc6c4d040b7597c4fd4d08879962))
* **i18n:** engage compact header earlier for fr/es; log the locale QA passes ([1907457](https://github.com/punkch/form-forge/commit/19074579551ee1bcdd4feb70311380f0be5835a0))
* **i18n:** localize question-type names, descriptions and palette categories ([ded393a](https://github.com/punkch/form-forge/commit/ded393aa4dc7b824d86f5ea63200053c2e2bf727))
* more workspace management fixes ([9e1a459](https://github.com/punkch/form-forge/commit/9e1a45902b246f0a42a28fb7140abf363c73f119))
* possition web-form error banners in the dedicated container. ([1f9768a](https://github.com/punkch/form-forge/commit/1f9768abd5d6a616cae1cbd8d10bb4448606ac90))
* **preview:** contain web-forms geolocation error banner to the preview frame ([f3a1461](https://github.com/punkch/form-forge/commit/f3a1461cf02832f709231d50195081e7fd1e7841))
* **registry:** fill parameter metadata gaps against ODK docs ([d58594a](https://github.com/punkch/form-forge/commit/d58594a862a0649f0568b9eec18eba57e34af575))
* **settings:** constant dialog frame across General/Entities tabs ([b7d459e](https://github.com/punkch/form-forge/commit/b7d459eb457e3ca54da656f441718375f10ca696))
* **settings:** let the id/version row shrink to the dialog frame ([31f676f](https://github.com/punkch/form-forge/commit/31f676fbf14d7b843198035cfdf002e9fcec4022))
* **theme:** pin dialog and drawer text colour to the ODK text token in dark ([87b54f0](https://github.com/punkch/form-forge/commit/87b54f0bde30785eea313f9b24e7b7c6ef131f46))
* **theme:** readable web-forms preview labels in dark mode ([9a79e20](https://github.com/punkch/form-forge/commit/9a79e20c83d2063a642765d35f7e9b01f829498c))


### Code Refactoring

* address wave-1 code-review findings ([4710bec](https://github.com/punkch/form-forge/commit/4710bec3fb868568f9f1dab93b38e50da70f4980))
* **properties:** animate section collapse via grid fold ([76f97a7](https://github.com/punkch/form-forge/commit/76f97a79831cc85d9f4042b2ce212ec0e5ec7395))
* **styles:** extract stable-dialog frame into shared .ff-stable-dialog ([1c9c22b](https://github.com/punkch/form-forge/commit/1c9c22b373a65dd888a98e62a09c9b3601fe3dfa))


### Documentation

* log the settings-dialog overflow fix verification ([7564d93](https://github.com/punkch/form-forge/commit/7564d93b636fa8150ee6787c5b9f0025f149b2a4))
* media-labels spec, verification log, roadmap and index updates ([fbdd5bf](https://github.com/punkch/form-forge/commit/fbdd5bf06b82eca49e8568838d4f9b5d4727eb3b))
* note the ff-stable-dialog shared modal recipe in the code map ([cf215a6](https://github.com/punkch/form-forge/commit/cf215a67abe11411b2275435a08ac39b26031d4a))
* **product:** bring mission, roadmap and tech-stack up to date ([a6d60e9](https://github.com/punkch/form-forge/commit/a6d60e9a572cebacd25f494e064f09e6581fc38b))
* record motion polish delivery ([77c3117](https://github.com/punkch/form-forge/commit/77c3117a583fde99fce9018fade518d4b4165cf8))
* **specs:** promote six backlog proposals to implementation specs ([05dd73a](https://github.com/punkch/form-forge/commit/05dd73a7b61907df108a70ada0df325a4190018a))
* **specs:** retire the delivered backlog folder ([555569b](https://github.com/punkch/form-forge/commit/555569b06da731a0256c843a9eca6df195c1aa24))
* **styles:** motion.css note follows the ff-stable-dialog extraction ([09ccf17](https://github.com/punkch/form-forge/commit/09ccf17ca3d539c3dca75984cc81e90f7ca54aaf))
* sweep for the 2026-07-16 six-spec burn-down ([870f6e6](https://github.com/punkch/form-forge/commit/870f6e600ccf45c09cbe787154ac20904d39da1e))
* work directly on main (drop development branch convention) ([404af78](https://github.com/punkch/form-forge/commit/404af781d25fa2f9728ee2ee2cded05d6dc933e3))

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
