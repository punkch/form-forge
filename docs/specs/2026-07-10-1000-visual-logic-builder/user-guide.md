# Building Form Logic Visually — Author Guide

Skip logic (when a question shows) and constraints (which answers are
accepted) can now be built with dropdowns instead of typed expressions.
Select a question, open the **Logic** section of the property panel, and
use the **Visual | Raw** toggle at the top of *Relevant (skip logic)* and
*Constraint*.

## Skip logic (Relevant)

1. Click **Visual**, then **Add condition**.
2. Each condition is a row: **question** / **operator** / **value**.
   - The operator list adapts to the question you pick: number and date
     questions offer `=`, `!=`, `<`, `<=`, `>`, `>=`; choice questions offer
     *includes* / *doesn't include*; text questions add *length* checks and
     *matches pattern*.
   - The value box adapts too: a number spinner for numeric questions, a
     date picker for dates, and a dropdown of the actual choices for select
     questions.
3. With two or more conditions, an **All | Any** toggle appears: **All**
   means every condition must hold (`and`); **Any** means at least one
   (`or`).
4. **Add group** creates a bracketed sub-group with its own All/Any toggle —
   e.g. *age ≥ 18* **and** (*status includes refugee* **or** *status
   includes idp*). One level of grouping is supported visually.
5. Remove a row with its ✕; removing a group's last row removes the group.

## Constraints

Constraints describe the answer being entered, so the question picker
offers **This answer (.)** — e.g. *This answer ≥ 0* and *This answer
≤ 120*. The **Common patterns** dropdown fills the rows for you:

- **Number between 0 and 100** — edit the bounds after inserting.
- **Phone number (North American)**, **Email address**, **Letters only** —
  pattern checks you can tweak in the value box.

Remember to set a **Constraint message** so enumerators know why an answer
was rejected.

## Calculations

Calculations remain formulas, but **Insert a formula…** below the
calculation box drops in a ready template using your form's own fields:
arithmetic (`a + b`), if/else, combining text, and days between two dates.
Insert one, then adjust the field references — typing `${` still
autocompletes question names.

## Switching between Visual and Raw

- Anything you build visually is an ordinary XLSForm expression — flip to
  **Raw** any time to see or hand-edit it, and back again.
- If an expression uses features the visual builder doesn't understand
  (`instance()` lookups, arithmetic, `if()`, date functions…), it opens in
  **Raw** and the Visual tab is disabled with an explanation. Your
  expression is never modified or lost — the builder only rewrites an
  expression when you edit its rows.
- Editing the raw text keeps you in Raw until you switch back yourself, so
  the editor never jumps while you type.

## Verify it works

Open the **Preview** panel while editing: answers you enter there evaluate
your logic live — e.g. with skip logic *age ≥ 18*, the dependent question
appears the moment you type an adult age.
