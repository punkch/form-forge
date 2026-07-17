# Preview follows canvas selection — User Guide

## What it does

The live preview now follows your selection on the canvas:

- **Click a question on the canvas** (or select it any other way) and the
  preview pane scrolls to that question and briefly highlights it. If the
  question is already fully visible, it just highlights — no scroll jump.
- **While you edit a question's properties** (label, hint, appearance…),
  the preview regenerates as you type. It now returns to the question you
  are editing after each refresh instead of jumping back to the top.
- **Selecting a group or repeat** scrolls to its first question.

## Notes & limits

- The preview and the builder don't share question identifiers, so the
  match is made by label text and position. In rare setups — two questions
  with the *same* label where one is currently hidden by a relevance
  condition — the preview may land on the identically-labeled twin. The
  highlight flash shows you exactly where it landed.
- A question that is currently **hidden by its relevance condition** isn't
  rendered in the preview at all, so there is nothing to scroll to —
  selection simply doesn't move the preview.
- Model-only fields (Calculation, metadata types) never render in the
  preview; selecting them doesn't scroll.
- With **reduced motion** enabled in your OS, the scroll jumps instantly
  and the highlight is effectively disabled.
