# ODK-terminology glossary — French & Spanish

> **This is a starting point for translation drafting (Tasks 2/3), not a
> locked spec.** It anchors Form Forge's French/Spanish UI vocabulary to
> the vocabulary ODK's own tools already ship, so a form designer moving
> between Form Forge and ODK Central / ODK Collect sees one consistent set
> of words. Where a specific rendered-context need in a namespace file
> conflicts with an entry here, the translator should note the deviation in
> that namespace's drafting notes rather than silently diverging from this
> table.

## Sources fetched (2026-07-16, all reachable — no fallback needed)

- `getodk/central-frontend`, master branch, `raw.githubusercontent.com`:
  - `apps/central/src/locales/fr.json` (426 lines)
  - `apps/central/src/locales/es.json` (412 lines)
- `getodk/collect`, master branch, `raw.githubusercontent.com`:
  - `strings/src/main/res/values-fr/strings.xml` (1,205 lines)
  - `strings/src/main/res/values-es/strings.xml` (1,205 lines)

All four fetches returned HTTP 200; nothing in this glossary is flagged
`(unverified — source unreachable)`.

**Source column legend:** `Central` / `Collect` = the exact string (or a
direct morphological variant — e.g. a singular derived from a confirmed
plural) was found in that project's shipped locale file, cited below the
table. `coined` = neither source renders this concept as a standalone UI
string (mostly because it's a form-*authoring* concept — Central only
*manages* forms, Collect only *fills* them — neither builds them), so the
term is coined here, consistent with the confirmed roots above it, and
flagged inline per the drafting brief.

## Glossary table

| English | Français | Español | Source |
| --- | --- | --- | --- |
| form | Formulaire | Formulario | Central |
| draft | Ébauche | Borrador | Central |
| submission | Soumission | Envío | Central |
| publish | Publier | Publicar | Central |
| publish target | Cible de publication (coined — no direct ODK-ecosystem precedent found) | Destino de publicación (coined — no direct ODK-ecosystem precedent found) | coined |
| choice list | Liste de choix (coined — no direct ODK-ecosystem precedent found) | Lista de opciones (coined — no direct ODK-ecosystem precedent found) | coined (extends Collect's *choices*) |
| choice | Choix | Opción | Collect (singular derived from confirmed plural *Choix*/*Opciones*) |
| choice filter | Filtre de choix (coined — no direct ODK-ecosystem precedent found) | Filtro de opciones (coined — no direct ODK-ecosystem precedent found) | coined |
| question | Question (coined — no direct ODK-ecosystem precedent found) | Pregunta (coined — no direct ODK-ecosystem precedent found) | coined (Collect's `guidance_hint_title` es text contains *preguntas* in passing, but neither source labels the standalone concept) |
| appearance | Apparence (coined — no direct ODK-ecosystem precedent found) | Apariencia (coined — no direct ODK-ecosystem precedent found) | coined |
| required | Obligatoire | Obligatorio | Collect |
| relevant (skip logic) | Pertinence (coined — no direct ODK-ecosystem precedent found) | Relevancia (coined — no direct ODK-ecosystem precedent found) | coined |
| constraint | Contrainte | Restricción | Collect (noun form derived from confirmed `constraint_behavior`) |
| calculation | Calcul (coined — no direct ODK-ecosystem precedent found) | Cálculo (coined — no direct ODK-ecosystem precedent found) | coined |
| hint | Indice (coined — no direct ODK-ecosystem precedent found) | Pista (coined — no direct ODK-ecosystem precedent found) | coined |
| guidance hint | Instructions supplémentaires (guidance hints) | Guías de preguntas | Collect |
| default value | Valeur par défaut (coined — no direct ODK-ecosystem precedent found) | Valor predeterminado (coined — no direct ODK-ecosystem precedent found) | coined |
| attachment | Fichier joint (also *pièce jointe*) | Adjunto | Central |
| workspace | Espace de travail (coined — no direct ODK-ecosystem precedent found) | Espacio de trabajo (coined — no direct ODK-ecosystem precedent found) | coined (Central's own top-level concept is "Project", not "workspace") |
| server | Serveur | Servidor | Central |
| credential / vault | Coffre-fort des identifiants (coined — no direct ODK-ecosystem precedent found) | Bóveda de credenciales (coined — no direct ODK-ecosystem precedent found) | coined (informed by Central's confirmed *Mot de passe*/*Contraseña* for "password") |
| dataset | Jeu de données (coined — no direct ODK-ecosystem precedent found) | Conjunto de datos (coined — no direct ODK-ecosystem precedent found) | coined (Central never surfaces the bare word "dataset" to end users — it always renders the concept as "entity list", confirmed below; Form Forge's own XLSForm-authoring sense of "dataset" is distinct enough to need its own term) |
| entity | Entité | Entidad | Central |
| entity list | Liste d'entités | Lista de entidades | Central |
| template | Modèle (coined — no direct ODK-ecosystem precedent found) | Plantilla (coined — no direct ODK-ecosystem precedent found) | coined |
| cascading select | Sélection en cascade (coined — no direct ODK-ecosystem precedent found) | Selección en cascada (coined — no direct ODK-ecosystem precedent found) | coined |
| itemset | Jeu d'éléments (itemset) (coined — no direct ODK-ecosystem precedent found) | Conjunto de elementos (itemset) (coined — no direct ODK-ecosystem precedent found) | coined (parenthetical English term kept, mirroring Collect's own `guidance_hint_title` pattern of keeping "guidance hints" parenthetically) |
| group | Groupe | Grupo | Collect |
| repeat | Groupe répétitif | Grupo repetible | Collect |
| translation / language | Langue | Idioma | Collect |
| validation | Validation | Validación | Collect |
| warning / error | Avertissement / Erreur | Advertencia / Error | Central |
| preview | Aperçu (du formulaire) | Vista previa (del formulario) | Central |

## Citations for sourced terms

- **Central `fr.json`/`es.json`** — `plural.form`: `"Formulaire \| Formulaires \| Formulaires"` / `"Formulario \| Formularios \| Formularios"`; `resource.draft`: `"Ébauche"` / `"Borrador"`; `resource.submission`/`plural.submission`: `"Soumission"` / `"Envío"`; `audit.action.form.update_publish`: `"Publier l'ébauche"` / `"Publicar borrador"`; `resource.attachments`/`resource.formAttachments`: `"Fichiers joints"` / `"Adjuntos"`; `resource.config`: `"Configuration du serveur"` / `"Configuración del servidor"` (confirms *serveur*/*servidor*); `resource.entity`: `"Entité"` / `"Entidad"`; `resource.entityList`: `"Liste d'entités"` / `"Lista de entidades"`; `resource.formPreview`: `"Aperçu du Formulaire"` / `"Vista previa del formulario"`; `field.error`/`field.warning`: `"Erreur"`/`"Avertissement"` / `"Error"`/`"Advertencia"`; `field.password`: `"Mot de passe"` / `"Contraseña"`.
- **Collect `strings.xml` (values-fr/values-es)** — `required_answer_error`: `"Réponse obligatoire!"` / `"¡Respuesta obligatoria!"` (confirms *obligatoire*/*obligatorio*); `choices`: `"Choix"` / `"Opciones"`; `constraint_behavior`/`constraint_behavior_title`: `"Comportement du traitement des contraintes"`/`"Traitement de contraintes"` / `"Manejo de las restricciones"`/`"Manejo de restricciones"`; `guidance_hint_title`: `"Afficher les instructions supplémentaires (guidance hints)"` / `"Mostrar guías de preguntas"`; `group_label`: `"Groupe"` / `"Grupo"`; `repeatable_group_label`: `"Groupe répétitif"` / `"Grupo Repetible"`; `language`/`change_language`: `"Langue"`/`"Changer la langue"` / `"Idioma"`/`"Cambiar el Idioma"`; `survey_saving_validating_message`: `"Validation des réponses…"` (fr, confirms the noun *validation*); `constraint_behavior_on_finalize`: `"Postponer validación hasta el final"` (es, confirms the noun *validación*).

## Notes on coined terms

- Every coined entry follows the same discipline: reuse the morphology of
  the nearest confirmed root (e.g. *contrainte*/*restricción* → *validation
  de contrainte*-style compounds; *Choix*/*Opciones* → *liste de
  choix*/*lista de opciones*) rather than inventing an unrelated word.
- `itemset` and `guidance hint` both intentionally keep the English term
  parenthetically, matching Collect's own precedent of writing `"(guidance
  hints)"` inline in its French string rather than translating it away —
  a pattern worth following wherever an XLSForm column name itself is part
  of what a form author needs to recognize.
- `dataset` vs. `entity list`: Form Forge uses "dataset" for the
  XLSForm-authoring concept (the `entities` sheet / dataset declaration)
  and should keep that word distinct from "entity list" (the published,
  queryable result Central manages) even though the two are closely
  related — namespace drafting notes should call out this distinction
  where both appear in the same view.
