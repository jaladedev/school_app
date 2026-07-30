# Markdown Editor UI/UX Improvements — Updated To-Do

Baseline: current editor is `components/NoteEditor.tsx` — a `<textarea>` with manual markdown-insertion helpers, side-by-side preview, LaTeX/KaTeX math, and Mermaid diagram generation. Not a bare textarea, but not rich text either. Moving to TipTap.

## 0. Core Migration (new — do this first, everything else builds on it)

* Replace `<textarea>` in `NoteEditor.tsx` with TipTap `useEditor` + `EditorContent`
* Add `tiptap-markdown` for Markdown serialize/deserialize (keep DB storage format unchanged)
* Rebuild toolbar buttons as `editor.chain().focus().toggleX().run()` calls (replaces current `replaceSelection` string-manipulation logic)
* Test round-trip against existing saved notes for lossy edge cases (raw HTML, GFM quirks) before cutover
* Port math support to `@tiptap/extension-mathematics` (KaTeX) — keep parity with current `$...$` / `$$...$$` toolbar buttons
* Build a custom TipTap Node for `[[resource:UUID]]` markers → renders as the resource card described in #6
* Build a custom TipTap Node wrapping existing `MermaidDiagram` component as a NodeView (keep `createMermaidResource` action)

## 1. Rich Text Editor — SUPERSEDED by #0
(was: use TipTap instead of textarea — now the plan, not a to-do)

## 2. Modern Formatting Toolbar

Currently have: Bold, Italic, Heading, inline/block math, table snippet insert.
Still need:
* Underline, Strikethrough
* Text color, Highlight
* Superscript/Subscript
* Text alignment
* Blockquote
* Horizontal rule
* Undo/Redo (TipTap has built-in history — just wire buttons)
* Paragraph styles dropdown

## 3. Lists

* Bullet lists — extension exists, needs UI button
* Numbered lists — extension exists, needs UI button
* Checklists (`@tiptap/extension-task-list`)
* Nested lists
* Indentation controls

## 4. Tables

Currently: inserts a static markdown snippet only.
* Swap to `@tiptap/extension-table` for a real visual editor
* Add/Delete rows, Add/Delete columns
* Merge cells
* Resize columns

## 5. Image Handling

Not present today beyond separate file upload panel.
* Drag-and-drop image upload into the editor
* Paste images directly
* Resize images
* Image captions
* Image alignment
* Replace images

## 6. Resource Improvements

Currently: `[[resource:UUID]]` text markers + a picker dropdown (`TopicResourceList`/`NoteEditor` picker) — functional but not friendly.
* Ship the custom Resource Node from #0 so markers render as cards inline (📷 📄 🎥 etc.)
* Preview, Edit, Replace, Remove — most map to existing `deleteTopicResource` / upload actions, just need in-editor UI
* Drag to reorder

## 7. Drag & Drop Uploads

Currently: separate `TopicResourceUpload` panel (file picker, not drag-and-drop), supports image/pdf/audio/video already.
* Add drag-and-drop directly onto the editor surface
* Auto-insert as Resource Node on successful upload

## 8. Slash Commands

Not present. New build.
* `/` command menu using TipTap's suggestion utility
* Items: Heading, Table, Image, Video, Diagram (reuse Mermaid panel), Activity, Homework, Learning Objective, Note, Callout, Divider

## 9. Floating Text Formatting Menu

Not present. New build via TipTap's `BubbleMenu`.
* Bold, Italic, Underline, Highlight, Link

## 10. Block-Based Editing

Not present — content is currently one flat markdown string. Biggest structural change after #0.
* Drag sections, Duplicate sections, Delete sections
* Collapse/Expand sections
* Reorder sections

## 11. Better Preview

Currently: fixed 2-column Markdown/Preview grid (no toggle modes).
* With TipTap, "Edit" view IS the rendered view — reframe this as view *modes* on top of one WYSIWYG doc:
* Preview (read-only render)
* Split View (keep current side-by-side as an option)
* Student View
* Presentation View

## 12. Resizable Split Screen

Currently fixed-width grid columns.
* Add drag-to-resize between edit/preview panes

## 13. Auto Save

Not present — explicit Save Draft / Publish buttons only.
* Periodic auto-save
* Saving indicator
* Last saved timestamp
* Offline detection

## 14. Version History

**Check first** — `NoteVersionDiff.tsx` already exists in the codebase. Audit before building:
* Confirm it already covers: view previous versions, compare, restore, author/timestamp
* Only build what's missing

## 15. Learning Objective Block

New — build as a TipTap custom Node (or slash-command insert):
* Learning objectives, Success criteria, Expected outcomes

## 16. Assessment Block

Currently: assessments are a separate system (`CreateAssessmentForm`, `GradeEntryForm`), not embeddable in notes.
* Decide: embed a lightweight reference/preview block in the note, or keep fully separate — needs a product decision before building
* If embedding: Multiple Choice, True/False, Fill in the Blank, Matching, Essay

## 17. Callout Components

Not present as structured blocks (Mermaid exists, callouts don't).
* Tip, Important, Warning, Remember, Definition, Example, Activity — build as TipTap custom Nodes, expose via slash command

## 18. Better Mermaid Support

Currently: single free-text Mermaid code box + live preview, inserted as a resource.
* Keep live preview (already built)
* Add starter templates: Flowcharts, Mind Maps, Timelines, Cycles, Org Charts, Sequence Diagrams

## 19. Math Editor — MOSTLY DONE, re-scope

Currently: LaTeX via `$...$`/`$$...$$` with toolbar buttons and KaTeX rendering — solid.
* Remaining gap: a *visual* equation builder (no manual LaTeX) — this is the only new piece; keep the existing LaTeX path as a power-user fallback

## 20. Emoji Picker

Not present. New build.

## 21. Symbol Picker

Not present. New build — Mathematics, Science, Greek letters.

## 22. Link Preview

Not present. New build — title, thumbnail, description on paste/insert.

## 23. Video Embedding

Currently: video files upload as a resource type, no embed-by-URL.
* Add YouTube/Vimeo URL embedding
* Keep existing uploaded-video resource path

## 24. Audio Embedding

Currently: audio files upload as a resource type already (voice notes, lessons, podcasts covered by existing upload).
* Mostly done — confirm playback UI is adequate, otherwise no major new work

## 25. Code Blocks

Not present. New build via `@tiptap/extension-code-block-lowlight`.
* Syntax highlighting, Copy button, Language selector

## 26. Search & Replace

Not present. New build.

## 27. Spell Check

Not present.
* Spell checking (can lean on browser-native `spellcheck` attribute as a first pass)
* Grammar suggestions (bigger lift — likely third-party service)

## 28. Word Statistics

Not present. New build via `@tiptap/extension-character-count` + custom counts for headings/tables/images/resources.

## 29. Keyboard Shortcuts

TipTap ships common ones (Ctrl+B/I) by default — mostly free with migration.
* Still need: Ctrl+K (link), Ctrl+S (save), Ctrl+/ (slash menu), Tab/Shift+Tab (indent)
* Add shortcut hints in UI

## 30. Focus Mode

Not present. New build — hide sidebar/toolbar/nav.

## 31. Fullscreen Editing

Not present. New build.

## 32. Mobile Optimization

Not present. New build — Write / Preview / Resources tabs.

## 33. Resource Sidebar

Currently: resources listed via `TopicResourceList`, inserted via a dropdown picker — not a persistent sidebar.
* Convert to persistent sidebar with one-click insertion (ties into #6 Resource Node)

## 34. Drag-and-Drop Reordering

Not present for sections/images/activities/resources — depends on #10 (blocks) existing first.

## 35. Presentation Mode

Not present. New build — full-screen slide view (`NoteSlideView.tsx` exists, worth checking before building from scratch).

## 36. Student Engagement Components

Not present. New build — Polls, Quick questions, Reflection prompts, Classroom activities (likely custom Nodes, same pattern as #15/#17).

## 37. Accessibility Features

Not present as a checked-off set.
* Full keyboard navigation, Screen reader compatibility, High-contrast mode, Adjustable font sizes, Dyslexia-friendly font option

---

## Suggested build order
1. #0 Core TipTap migration (blocking everything else)
2. #2/#3 toolbar + lists, #9 floating menu, #29 shortcuts (cheap wins once #0 lands)
3. #6/#7 resource cards + drag-drop upload
4. #4 tables, #5 images, #25 code blocks (official extensions, mostly config)
5. #8 slash commands, #17 callouts, #15 learning objectives (custom nodes, same pattern)
6. #13 autosave, #12 resizable panes, #28 word stats
7. #10 block-based editing (structural — do after the above stabilize)
8. Everything else (#20–24, #26, #27, #30–37) — lower priority, mostly additive

## Before building, verify these already exist
* #14 Version History → `NoteVersionDiff.tsx`
* #35 Presentation Mode → `NoteSlideView.tsx`
* #24 Audio embedding → existing upload resource type may already cover this
