# Markdown Editor UI/UX Improvements — Updated To-Do

Baseline: `components/NoteEditor.tsx` has been migrated off the old `<textarea>` onto TipTap (`useEditor` + `EditorContent`). #0 is DONE — see status below. Everything from #2 onward should be read against the TipTap version, not the old textarea implementation the rest of this doc originally described.

## 0. Core Migration — DONE

- ✅ Replaced `<textarea>` with TipTap `useEditor` + `EditorContent`
- ✅ `tiptap-markdown` wired for serialize/deserialize; DB storage format (plain markdown, byte-compatible) unchanged
- ✅ Toolbar rebuilt on `editor.chain().focus().toggleX().run()` calls
- ✅ Custom TipTap Node for `[[resource:UUID]]` markers (`ResourceChip` in `lib/tiptap/resource-node.tsx`) renders as a resource chip — covers the #6 card requirement at the node level; the richer picker/reorder UX in #6 is still open
- ✅ Math ported to hand-rolled `MathInline`/`MathBlock` nodes (`lib/tiptap/math-nodes.tsx`) with KaTeX rendering, not `@tiptap/extension-mathematics` as originally planned — parses `$...$` / `$$...$$` with flanking rules matched to `remark-math`'s grammar so notes render identically in the editor and in the published-note preview (`TopicContent.tsx`, `QuestionText.tsx`)
- ✅ Mermaid diagrams now render inline as a live diagram directly in the doc, not hidden behind a click-to-preview chip — `diagram_mermaid` resources get their own rendering branch inside `ResourceChip`'s node view (`MermaidNodeView` in `resource-node.tsx`), reusing `TopicResourceItem`/`MermaidDiagram` for the actual render. Still inserted via the existing side-panel + `createMermaidResource` (unchanged), and still schema-`inline` under the hood (rendered as `as="div"` so it visually lays out full-width) — no new markdown grammar or DB round-trip needed, since it rides the same `[[resource:ID]]` marker as every other resource type. Has its own confirm-before-remove (hover-revealed) instead of the click-to-open popover other resource types use, since the diagram is already fully visible.
- ⬜ Formal round-trip test against a corpus of existing saved notes (raw HTML, GFM edge cases) hasn't been done — worth doing before this ships to all teachers, not just the ones who found bugs so far

### Bugs hit and fixed during the migration (for context on the current implementation)

- `tiptap-markdown` has no global `markdownIt` hook — parse rules must be registered per-node via `storage.markdown.parse.setup`, not passed into `Markdown.configure()`
- TipTap v3 moved `BubbleMenu` to `@tiptap/react/menus` and dropped the tippy.js-based `tippyOptions` prop
- `@tiptap/extension-bubble-menu` is only an optional peer of `@tiptap/react`'s menus build — had to be added as a direct dependency or it silently fails to install on some platforms
- StarterKit v3 bundles `Link` internally now (wasn't true in v2) — adding `Link` as a separate extension double-registers it; configure it via `StarterKit.configure({ link: {...} })` instead
- TipTap v3 auto-detects Next.js/SSR and defaults `immediatelyRender` to `false` itself now — don't set it explicitly, it just logs a notice
- `editor.storage.resourceChip` needed a `declare module "@tiptap/core"` augmentation to type-check
- `.ProseMirror` has no default padding/first-child margin handling of its own — needed explicit CSS in `globals.css` beyond the wrapper's `p-4`
- **`tailwind.config.ts`'s `content` glob only covered `./app/**` and `./components/**`, not `./lib/**`.** `ResourceChip`/math nodes live in `lib/tiptap/`, so any Tailwind class used only there (never appearing verbatim elsewhere in a scanned file) was silently purged from the build — no build error, just missing styles. Fixed by adding `"./lib/**/*.{ts,tsx}"` to `content`. Confirmed both via a real `tailwindcss` CLI build and in a teacher's actual browser after a `.next` cache clear + restart — the resource-chip popover now renders at full size (`w-[28rem]`).
- Clicking an atom NodeView (ResourceChip, math nodes) lets ProseMirror establish its own `NodeSelection` over the node before React's `onClick` fires; combined with `BubbleMenu`'s live selection tracking this caused a `RangeError: Selection passed to setSelection must point at the current document` crash. Fixed by passing `stopEvent: () => true` to both nodes' `ReactNodeViewRenderer` so ProseMirror hands all DOM events on these atoms to React instead of managing selection itself.

## 1. Rich Text Editor — SUPERSEDED by #0

(was: use TipTap instead of textarea — now shipped)

## 2. Modern Formatting Toolbar — DONE (pending round-trip caveat below)

Currently have: Bold, Italic, Underline, Strikethrough, Heading, Bulleted/Numbered list, Blockquote, Horizontal rule, inline/block math, table insert, Undo/Redo, link (via BubbleMenu).

- ✅ Text color (`@tiptap/extension-color` + `@tiptap/extension-text-style`) — swatch in toolbar
- ✅ Highlight (`@tiptap/extension-highlight`, multicolor) — toolbar button + BubbleMenu button (#9)
- ✅ Superscript/Subscript (`@tiptap/extension-subscript` / `-superscript`)
- ✅ Text alignment (`@tiptap/extension-text-align`, left/center/right/justify) on paragraph + heading
- ✅ Paragraph styles dropdown — replaces the old single "H" button; Paragraph/H1/H2/H3

**Markdown round-trip — FIXED.** Added `lib/tiptap/format-marks.ts`: wraps Highlight/Subscript/Superscript/TextStyle with markdown serialize+parse rules (same `storage.markdown` pattern as `MathInline`/`MathBlock`). Highlight/Sub/Superscript use the `markdown-it-mark` / `-sub` / `-sup` plugins (`==text==`, `~sub~`, `^sup^`); Color uses a small hand-rolled `{color=#hex}...{/color}` rule (no standard convention exists for inline color, and it's non-nesting — a bolded word inside a colored run won't survive a reload, everything else does). Underline still has the same pre-existing gap; out of scope here since it predates this pass.

## 3. Lists — DONE

- ✅ Bullet lists — button in toolbar
- ✅ Numbered lists — button in toolbar
- ✅ Checklists (`@tiptap/extension-task-list` + `-task-item`, nested) — has full markdown round-trip since `tiptap-markdown` ships built-in `- [ ]`/`- [x]` serialization for these
- ✅ Nested lists — already worked via StarterKit's `ListItem` sink/lift keymap, now also exposed explicitly
- ✅ Indentation controls — explicit Indent/Outdent toolbar buttons (`sinkListItem`/`liftListItem`), work for both bullet/ordered lists and task lists

## 4. Tables

Currently: inserts a static markdown snippet only.

- Swap to `@tiptap/extension-table` for a real visual editor
- Add/Delete rows, Add/Delete columns
- Merge cells
- Resize columns

## 5. Image Handling

Not present today beyond separate file upload panel.

- Drag-and-drop image upload into the editor
- Paste images directly
- Resize images
- Image captions
- Image alignment
- Replace images

## 6. Resource Improvements

Currently: `[[resource:UUID]]` renders inline as a `ResourceChip` node (📷 📄 🎥 etc., #0). Clicking a chip opens a popover (`28rem` wide, type-correct preview reusing `TopicResourceItem` from `TopicContent.tsx`) with a two-step "Remove from note" action (asks to confirm before deleting the marker — never touches the underlying resource row).

- Still need: Edit (still open for non-diagram resource types — images/PDFs/etc. don't have an update path yet, only diagrams do via #18's `updateMermaidResource`), Replace (swap for a different existing resource without reopening the whole insert flow)
- Drag to reorder

## 7. Drag & Drop Uploads — DONE

Currently: separate `TopicResourceUpload` panel (file picker, not drag-and-drop), supports image/pdf/audio/video already.

- ✅ Drag-and-drop directly onto the editor surface — dashed-border overlay while dragging, reuses `uploadTopicResource` (same server action the file-picker panel already used), gated on `noteId` existing (same requirement diagrams already had) with a toast telling the teacher to save a draft first if not
- ✅ Auto-insert as Resource Node on successful upload — each accepted file gets uploaded then a `ResourceChip` inserted at the caret, same call `insertResourceMarker` already used for diagrams; multiple files drop = sequential upload with an "Uploading N files…" indicator
- `uploadTopicResource` (lib/actions/teacher.ts) now returns the inserted row instead of void, so callers can insert a chip immediately without a full page refresh — the file-picker panel (`TopicResourceUpload.tsx`) still works unchanged since it never used the return value
- Client-side mime-type filtering before the upload call (rejects with a toast) using the same accepted-type list as `TopicResourceUpload`'s `<input accept>`; the server action is still the source of truth and re-validates

## 8. Slash Commands

Not present. New build.

- `/` command menu using TipTap's suggestion utility
- Items: Heading, Table, Image, Video, Diagram (reuse Mermaid panel), Activity, Homework, Learning Objective, Note, Callout, Divider

## 9. Floating Text Formatting Menu — DONE

Present via TipTap's `BubbleMenu` — has Bold, Italic, Underline, Highlight, Link.

## 10. Block-Based Editing

Not present — content is currently one flat markdown string. Biggest structural change after #0.

- Drag sections, Duplicate sections, Delete sections
- Collapse/Expand sections
- Reorder sections

## 11. Better Preview

Currently: fixed 2-column Markdown/Preview grid (no toggle modes).

- With TipTap, "Edit" view IS the rendered view — reframe this as view _modes_ on top of one WYSIWYG doc:
- Preview (read-only render)
- Split View (keep current side-by-side as an option)
- Student View
- Presentation View

## 12. Resizable Split Screen

Currently fixed-width grid columns.

- Add drag-to-resize between edit/preview panes

## 13. Auto Save

Not present — explicit Save Draft / Publish buttons only.

- Periodic auto-save
- Saving indicator
- Last saved timestamp
- Offline detection

## 14. Version History

**Check first** — `NoteVersionDiff.tsx` already exists in the codebase. Audit before building:

- Confirm it already covers: view previous versions, compare, restore, author/timestamp
- Only build what's missing

## 15. Learning Objective Block

New — build as a TipTap custom Node (or slash-command insert):

- Learning objectives, Success criteria, Expected outcomes

## 16. Assessment Block

Currently: assessments are a separate system (`CreateAssessmentForm`, `GradeEntryForm`), not embeddable in notes.

- Decide: embed a lightweight reference/preview block in the note, or keep fully separate — needs a product decision before building
- If embedding: Multiple Choice, True/False, Fill in the Blank, Matching, Essay

## 17. Callout Components

Not present as structured blocks (Mermaid exists, callouts don't).

- Tip, Important, Warning, Remember, Definition, Example, Activity — build as TipTap custom Nodes, expose via slash command

## 18. Better Mermaid Support

Currently: renders live inline in the doc as a real `MermaidNodeView` (#0), not just a chip — inserted via the side-panel + `createMermaidResource`, edited in place via a new `updateMermaidResource` action (hover-revealed "Edit" opens the same code+title+live-preview UI as creation, saves in place so the resource id and every `[[resource:ID]]` marker pointing at it stay valid).

- Keep live preview (already built)
- Add starter templates: Flowcharts, Mind Maps, Timelines, Cycles, Org Charts, Sequence Diagrams

## 19. Math Editor — MOSTLY DONE, re-scope

Currently: LaTeX via `$...$`/`$$...$$` with toolbar buttons and KaTeX rendering — solid.

- Remaining gap: a _visual_ equation builder (no manual LaTeX) — this is the only new piece; keep the existing LaTeX path as a power-user fallback

## 20. Emoji Picker

Not present. New build.

## 21. Symbol Picker

Not present. New build — Mathematics, Science, Greek letters.

## 22. Link Preview

Not present. New build — title, thumbnail, description on paste/insert.

## 23. Video Embedding

Currently: video files upload as a resource type, no embed-by-URL.

- Add YouTube/Vimeo URL embedding
- Keep existing uploaded-video resource path

## 24. Audio Embedding

Currently: audio files upload as a resource type already (voice notes, lessons, podcasts covered by existing upload).

- Mostly done — confirm playback UI is adequate, otherwise no major new work

## 25. Code Blocks

Not present. New build via `@tiptap/extension-code-block-lowlight`.

- Syntax highlighting, Copy button, Language selector

## 26. Search & Replace

Not present. New build.

## 27. Spell Check

Not present.

- Spell checking (can lean on browser-native `spellcheck` attribute as a first pass)
- Grammar suggestions (bigger lift — likely third-party service)

## 28. Word Statistics

Not present. New build via `@tiptap/extension-character-count` + custom counts for headings/tables/images/resources.

## 29. Keyboard Shortcuts

TipTap ships common ones (Ctrl+B/I/U) by default — mostly free with migration.

- ✅ Ctrl+S (save draft)
- ✅ Ctrl+K (link) — opens the same prompt as the BubbleMenu link button
- ✅ Tab/Shift+Tab (indent) — fixed a real bug: when there's no list item to sink/lift into or table cell to move to, every extension's Tab handler correctly returns false, but nothing was calling preventDefault, so the keydown fell through to the browser's native focus-tabbing and jumped to the next toolbar/chip button. Added a catch-all `TabTrap` extension that absorbs Tab/Shift-Tab as a last resort so focus never escapes the editor.
- Still need: Ctrl+/ (slash menu, once #8 exists)
- Add shortcut hints in UI — done for B/I/U toolbar buttons via `title`

## 30. Focus Mode

Not present. New build — hide sidebar/toolbar/nav.

## 31. Fullscreen Editing

Not present. New build.

## 32. Mobile Optimization

Not present. New build — Write / Preview / Resources tabs.

## 33. Resource Sidebar

Currently: resources listed via `TopicResourceList`, inserted via a dropdown picker — not a persistent sidebar.

- Convert to persistent sidebar with one-click insertion (ties into #6 Resource Node)

## 34. Drag-and-Drop Reordering

Not present for sections/images/activities/resources — depends on #10 (blocks) existing first.

## 35. Presentation Mode

Not present. New build — full-screen slide view (`NoteSlideView.tsx` exists, worth checking before building from scratch).

## 36. Student Engagement Components

Not present. New build — Polls, Quick questions, Reflection prompts, Classroom activities (likely custom Nodes, same pattern as #15/#17).

## 37. Accessibility Features

Not present as a checked-off set.

- Full keyboard navigation, Screen reader compatibility, High-contrast mode, Adjustable font sizes, Dyslexia-friendly font option

---

## Suggested build order

1. ~~#0 Core TipTap migration~~ — DONE (see status above; round-trip testing and the Mermaid NodeView are the two loose ends)
2. #2/#3 toolbar + lists, #9 floating menu, #29 shortcuts (cheap wins, low remaining scope now that #0 landed)
3. #6/#7 resource cards + drag-drop upload
4. #4 tables, #5 images, #25 code blocks (official extensions, mostly config)
5. #8 slash commands, #17 callouts, #15 learning objectives (custom nodes, same pattern)
6. #13 autosave, #12 resizable panes, #28 word stats
7. #10 block-based editing (structural — do after the above stabilize)
8. Everything else (#20–24, #26, #27, #30–37) — lower priority, mostly additive

## Before building, verify these already exist

- #14 Version History → `NoteVersionDiff.tsx`
- #35 Presentation Mode → `NoteSlideView.tsx`
- #24 Audio embedding → existing upload resource type may already cover this
