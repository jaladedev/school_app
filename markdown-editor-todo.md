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
- **Creating a brand-new topic note (no existing note yet) left "Insert resource"/"Generate diagram" permanently disabled after the first save, and the resource-upload section below the editor stuck on "Save the note once before attaching resources" forever.** Root cause: `page.tsx` is a Server Component that fetches `note`/`resources` once and passes them down as props; `saveTopicNote`'s `revalidatePath` only invalidates Next's cache, it doesn't refetch the already-mounted client tree, so `noteId` stayed `undefined` in the browser even after the note existed server-side — only a manual page reload picked it up. Fixed by calling `router.refresh()` in `handleSave`, but only when `noteId` wasn't already set (so routine saves on an existing note don't trigger an unnecessary refetch/remount while someone's actively typing).
  - Follow-up, same root issue: rather than just unlocking resource/diagram buttons _after_ a manual first save, `saveTopicNote` now returns the new note's `id` directly, tracked in a `currentNoteId` state (separate from the `noteId` prop) so it updates the instant a save resolves — no round trip through `router.refresh()` needed for the buttons to unlock, though the refresh still runs once to sync the server-rendered resource-upload section and status pill.
  - Added `ensureNoteId()`: "Insert resource" (via drag-drop) and "Generate Mermaid diagram" now silently create the first draft on the teacher's behalf the moment they're used, instead of requiring an explicit "Save draft" first — so writing the note and adding resources can happen in either order. **Known gap**: this isn't mutex'd against a concurrent manual "Save draft" click, so a teacher who drags a file in at the exact same moment they click Save could theoretically create two note rows in a race; noted here rather than fixed, since it needs a real click-to-happen-simultaneously edge case.
  - `page.tsx` was seeding a brand-new note's `initialContent` with literal placeholder markdown (`## Introduction\n\nWrite about "X" here.`) instead of leaving it empty — since `NoteEditor` already had a real TipTap `Placeholder` (ghost-text) extension wired but unused for this case, that literal seeded text was real, savable content: a teacher who opened a topic and immediately hit "Save draft" without typing anything published that placeholder sentence as if it were an actual note, with no warning. Fixed by passing an empty string as `initialContent` for a topic with no note yet, and threading a topic-title-aware message through a new `placeholder` prop (`NoteWorkspace` → `NoteEditor` → TipTap's `Placeholder.configure`) so the ghost text still shows, but never becomes saved content.
  - The teacher notes list page showed no-note topics with a passive gray "unwritten" pill, visually identical in weight to "draft"/"published". Changed to a distinct "+ Start writing" pill plus a dashed border on the row, so blank-slate topics read as an invitation rather than a status report.

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

## 4. Tables — DONE

Currently: real visual table editing via `@tiptap/extension-table` (resizable), inserted via a toolbar button (2x2 with header row). A contextual "Table:" toolbar appears whenever the caret is inside a table (`editor.isActive("table")`).

- ✅ Add/Delete rows (`addRowBefore`/`addRowAfter`/`deleteRow`)
- ✅ Add/Delete columns (`addColumnBefore`/`addColumnAfter`/`deleteColumn`)
- ✅ Merge/Split cells (`mergeCells`/`splitCell`, both disabled via `editor.can()` when the current selection doesn't support them rather than erroring)
- ✅ Toggle header row
- ✅ Delete table
- ✅ Resize columns (already had this via `Table.configure({ resizable: true })`, just wasn't checked off)

## 5. Image Handling — DONE

Was: not present beyond a separate file upload panel. Now covered by #6/#7's drag-drop + resource-node work:

- ✅ Drag-and-drop image upload into the editor (#7)
- ✅ Paste images directly — clipboard `File`-bearing `image/*` items intercepted in `editorProps.handlePaste`, reuses the same `uploadDroppedFiles` path as drag-and-drop
- ✅ Resize images — S/M/Full size control on hover (`ImageNodeView` in `resource-node.tsx`), stored as a `#size-align` suffix on the `[[resource:UUID#size-align]]` marker
- ✅ Image captions — resource `title` doubles as the caption (shown as `alt`), same as everywhere else images render
- ✅ Image alignment — left/center/right control alongside size, same node view
- ✅ Replace images — "Edit" on the popover / hover controls calls `updateTopicResource` with a new file, same resource id so every marker pointing at it stays valid (see #6)

**Bugs hit and fixed after initial ship:**

- **Freshly uploaded images showed "Image couldn't be loaded" immediately.** `uploadTopicResource`/`updateTopicResource` returned the DB row's `file_url` as-is — the private bucket's raw object path, not a fetchable URL — straight into the client's live resource list, which renders it right away. Every _read_ path (student topic page, id-card printing) already signed the URL first; these two write actions didn't. Fixed by signing the URL before returning it. Turned out the teacher note page's initial server-side load wasn't signing at all either (unlike the student page) — fixed there too, so a page refresh doesn't re-break images that display fine after upload.
- **A dropped-in image vanished from the note on refresh but still showed under "Topic resources."** `uploadDroppedFiles` only saved note content when `ensureNoteId` had to create a brand-new note — dropping a file into an _existing_ note inserted the marker into the live editor only, never persisted it. The underlying resource row was created fine (hence still visible in the sidebar list), just never referenced from saved note content.
  - First fix attempt made it save unconditionally on every drop — overcorrected: since `saveTopicNote` is append-only, this created a new throwaway draft _version_ on every single image drop, which is what surfaced as an extra stray draft needing manual deletion.
  - Correct fix: only auto-save when `ensureNoteId` bootstrapped a brand-new note (unavoidable — a resource needs a `note_id` to attach to). Dropping into an existing note now behaves exactly like typed text: the marker sits as an unsaved edit ("Unsaved changes" indicator already covers it) until the teacher clicks Save draft / Publish. Matches `handleSaveDiagram`'s existing (correct) behavior for Mermaid diagrams, which never had this bug.
- **Hydration mismatch on every note-editor page load** (`NoteEditor` rendered `null` until the editor was ready, then swapped in the entire toolbar+content subtree in one commit — React's dev hydration check flagged the appearing subtree as a mismatch). Fixed by keeping one stable outer `<div>` present in both the loading and ready states (a pulse placeholder swapped for real content inside it), so only children change post-mount instead of the whole subtree appearing from nothing.
- **Resource sidebar/list could go blank if signing one resource's URL failed** — the signing `Promise.all` in the note page had no per-item error handling, so one bad `createSignedUrl` call (stale key, deleted object) rejected the whole page's data fetch. Now each resource signs independently and falls back to its unsigned `file_url` on error instead of taking the rest of the list down with it.

## 6. Resource Improvements — DONE

Currently: `[[resource:UUID]]` renders inline as a `ResourceChip` node (📷 📄 🎥 etc., #0). Clicking a chip opens a popover (`28rem` wide, type-correct preview reusing `TopicResourceItem` from `TopicContent.tsx`) with a two-step "Remove from note" action (asks to confirm before deleting the marker — never touches the underlying resource row).

- ✅ Edit / Replace for non-diagram resource types — new `updateTopicResource` server action (lib/actions/teacher.ts), same "update in place, same resource id" approach `updateMermaidResource` already used so every `[[resource:ID]]` marker pointing at it keeps resolving. Takes a FormData with an optional `title` (rename) and/or `file` (replace the underlying object — re-validates mime type/size, uploads the new object, then removes the old one only after the row update succeeds, rolls back the new upload if the row update fails). Popover's "Edit" link opens a small inline form (title input + file input, hidden for `link` resources since those have no file) reusing the existing popover chrome rather than a new modal.
- ✅ Drag to reorder — resourceChip is a zero-content atom node, so reordering is delete-at-source + insert-at-target in one ProseMirror transaction (`moveResourceChip` in resource-node.tsx, shared by both NodeViews). A small `⠿` drag handle sits to the left of the chip (icon chips) or top-left on hover (inline Mermaid diagrams); native HTML5 drag-and-drop, `dataTransfer` carries the source position.

## 7. Drag & Drop Uploads — DONE

Currently: separate `TopicResourceUpload` panel (file picker, not drag-and-drop), supports image/pdf/audio/video already.

- ✅ Drag-and-drop directly onto the editor surface — dashed-border overlay while dragging, reuses `uploadTopicResource` (same server action the file-picker panel already used), gated on `noteId` existing (same requirement diagrams already had) with a toast telling the teacher to save a draft first if not
- ✅ Auto-insert as Resource Node on successful upload — each accepted file gets uploaded then a `ResourceChip` inserted at the caret, same call `insertResourceMarker` already used for diagrams; multiple files drop = sequential upload with an "Uploading N files…" indicator
- `uploadTopicResource` (lib/actions/teacher.ts) now returns the inserted row instead of void, so callers can insert a chip immediately without a full page refresh — the file-picker panel (`TopicResourceUpload.tsx`) still works unchanged since it never used the return value
- Client-side mime-type filtering before the upload call (rejects with a toast) using the same accepted-type list as `TopicResourceUpload`'s `<input accept>`; the server action is still the source of truth and re-validates

## 8. Slash Commands — DONE

Built on `@tiptap/suggestion` (`lib/tiptap/slash-command.tsx`), no tippy.js dependency — positioning done manually off the `clientRect()` the utility already provides. Arrow keys + Enter or click, filters as you type.

- Items: Heading, Table, Image, Video, Diagram (reuse Mermaid panel), Activity, Homework, Note, Callout, Divider (Learning Objective omitted — #15 suspended)
- "Activity"/"Homework" aren't separate block types — they insert the Callout node (#17) pre-set to those `calloutType`s
- "Image"/"Video" reuse the existing resource picker, "Diagram" reuses the existing Mermaid panel — both are React state in `NoteEditor`, reached via a small bridge object (`slashCommandBridge`) rather than duplicating that UI

## 9. Floating Text Formatting Menu — DONE

Present via TipTap's `BubbleMenu` — has Bold, Italic, Underline, Highlight, Link.

## 10. Block-Based Editing — V1 DONE

New `section` node (`lib/tiptap/section-node.tsx`) wraps a heading + every following block up to the next heading. Drag-to-reorder (native HTML5 drag armed only via the ⠿ handle, not the whole section), duplicate (⧉), delete (🗑), and collapse/expand (▾/▸, hides body via CSS without unmounting so ProseMirror position mapping stays intact) all work as single node operations. "Section" added to the slash-command menu (#8) to insert a new empty one.

Sections carry no markdown fence syntax — boundaries are fully recoverable from heading positions, so `serialize()` just flattens a section back to plain child content. That means the persisted markdown is byte-identical to an unsectioned doc: `saveTopicNote`, version history (#14), the published view, and Presentation Mode (#35) all need zero changes. Grouping happens once client-side, right after initial parse (`groupIntoSections()` in an `onCreate` transaction with `addToHistory: false`), not via a markdown-it block rule.

Known v1 limitations (deliberately deferred, not just missed):

- Every heading level starts a new flat section — an h3 doesn't nest inside its parent h2's section. Revisit only if sub-section dragging turns out to matter.
- Typing a new heading inside an existing section's body does **not** auto-split it — no input rule watches for that yet. Use the Section slash command to start a new one explicitly. Auto-split is a plausible v2 but needs care around mid-typing undo steps.
- Content before the first heading in a doc is left ungrouped at the top level.

This unblocks #34 (Drag-and-Drop Reordering), which was waiting on #10 existing.

**Bug found and fixed post-"done":** the grouping transaction was originally dispatched synchronously inside `onCreate`, which is silently discarded by Tiptap/ProseMirror — `docChanged` reports `true` but the state reverts right after, no error surfaced. Invisible on new/empty notes (nothing to group), so it only showed up opening a preexisting note. A timing sweep found the real cutover sits at a single animation frame, not any microtask count, pointing to the view's own render/measure cycle — fixed by deferring via `requestAnimationFrame` rather than guessing a `setTimeout` delay. Covered by `tests/section-grouping.test.ts` so this can't silently regress again.

## 11. Better Preview

Currently: fixed 2-column Markdown/Preview grid (no toggle modes).

- With TipTap, "Edit" view IS the rendered view — reframe this as view _modes_ on top of one WYSIWYG doc:
- Preview (read-only render)
- Split View (keep current side-by-side as an option)
- Student View
- Presentation View

## 12. Resizable Split Screen — NOT NEEDED

Written back when the editor was a fixed 2-column Markdown/Preview grid (see #11's note above — same reframing applies). Post-TipTap-migration there is no side-by-side pane at all: `NoteEditor.tsx` is a single WYSIWYG view (edit IS the render), and the mobile Write/Preview toggle (restored — see #32) swaps that one pane's editability rather than showing two panes together. Nothing to resize. Only reopen this if a genuine side-by-side mode (e.g. #11's "Split View" option) gets built later — until then, drop it.

## 13. Auto Save — DONE

Explicit Save Draft / Publish buttons remain for real saves, plus now periodic autosave. `NoteEditor.tsx` tracks `isDirty` against `lastSavedContent` and shows an "Unsaved changes" label + a `beforeunload` warning. Periodic autosave (every 20s, guarded by `isDirty`/online checks) writes to a new `topic_note_drafts` table via `saveTopicNoteDraft`/`getTopicNoteDraft`/`clearTopicNoteDraft` (`lib/actions/teacher.ts`) — a separate scratch table (upsert per topic/author, deleted on real save) rather than another `saveTopicNote` version row, avoiding the version-flooding problem. Offline detection via `navigator.onLine` + `online`/`offline` listeners. Saving indicator and last-saved timestamp tracked via `autosaveStatus`/`lastAutosaveAt`.

## 14. Version History

**Check first** — `NoteVersionDiff.tsx` already exists in the codebase. Audit before building:

- Confirm it already covers: view previous versions, compare, restore, author/timestamp
- Only build what's missing

## 15. Learning Objective Block — SUSPENDED

New — build as a TipTap custom Node (or slash-command insert):

- Learning objectives, Success criteria, Expected outcomes

**Suspended for now** (per request) — skip in the build order below until re-prioritized. Slash Commands (#8) should not list "Learning Objective" as a menu item while this is suspended, to avoid pointing at a block that doesn't exist.

## 16. Assessment Block

Currently: assessments are a separate system (`CreateAssessmentForm`, `GradeEntryForm`), not embeddable in notes.

- Decide: embed a lightweight reference/preview block in the note, or keep fully separate — needs a product decision before building
- If embedding: Multiple Choice, True/False, Fill in the Blank, Matching, Essay

## 17. Callout Components — DONE

Built as a TipTap custom Node (`lib/tiptap/callout-node.tsx`), exposed via slash command (#8) and a toolbar button. 8 types: Tip, Important, Warning, Remember, Definition, Example, Activity, Homework — each a colored card with an icon + type-switcher dropdown, real editable block content inside (`content: "block+"`, so paragraphs/lists/etc. all work, not just plain text).

Markdown round-trip via a `:::type ... :::` fence (Docusaurus/Obsidian-style admonition syntax) — a teacher who already knows that convention can type it by hand instead of going through the UI. Verified directly against markdown-it: nested formatting/lists parse correctly inside, surrounding content is untouched, and an unrecognized type falls through to plain text rather than producing a broken callout.

## 18. Better Mermaid Support — DONE

Renders live inline in the doc as a real `MermaidNodeView` (#0), not just a chip — inserted via the side-panel + `createMermaidResource`, edited in place via `updateMermaidResource` (hover-revealed "Edit" opens the same code+title+live-preview UI as creation, saves in place so the resource id and every `[[resource:ID]]` marker pointing at it stay valid).

- ✅ Live preview (already built)
- ✅ Starter templates: Flowchart, Mind Map, Timeline, Cycle, Org Chart, Sequence Diagram — a row of buttons above the code editor in the diagram panel (`DIAGRAM_TEMPLATES` in `NoteEditor.tsx`), each swapping in a short 2-4 node example a teacher can edit from rather than starting from a blank textarea or Mermaid's syntax quirks. "Cycle" isn't a real Mermaid diagram type — built as a `flowchart LR` that loops back to its first node, which is the standard way to express one.

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

## 25. Code Blocks — DONE

Built via `@tiptap/extension-code-block-lowlight` (`lib/tiptap/code-block.tsx`), extended with a React node view: language selector (19 common languages via `lowlight`'s `common` bundle), Copy button with a brief "Copied!" confirmation, `github-dark` highlight.js theme. No custom markdown serializer needed — `CodeBlockLowlight` keeps the same `codeBlock` node name/attrs StarterKit's plain version used, and tiptap-markdown already serializes fenced blocks with a language info string by default.

Registered by disabling StarterKit's built-in `codeBlock: false` and adding the new extension alongside it (avoids double-registering the node name).

**Published-view parity, done as a follow-up:** the published note (`TopicContent.tsx`) and Presentation Mode (`NoteSlideView.tsx`, both render paths) previously fell back to `react-markdown`'s unstyled default `<pre><code>` for fenced blocks — a teacher's code block looked different once published than it did while writing. Fixed by wiring `rehype-highlight` + the same `github-dark` theme into both, and adding matching `.topic-prose pre`/`code` CSS (same dark background/radius/padding as the editor's node view) in `globals.css` so editing, presenting, and the published/student view all render identically.

## 26. Search & Replace

Not present. New build.

## 27. Spell Check

Not present.

- Spell checking (can lean on browser-native `spellcheck` attribute as a first pass)
- Grammar suggestions (bigger lift — likely third-party service)

## 28. Word Statistics — DONE

Built via `@tiptap/extension-character-count` (words/characters) + custom `computeNoteStats()` in `NoteEditor.tsx` that walks the doc for headings/tables/images/resource chips, plus a rough reading-time estimate (words / 200 wpm).

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

## 32. Mobile Optimization — FIXED

Write/Preview tabs (`mobileTab` state, tab buttons, `md:hidden` toggle bar) were deleted with no replacement in the "Word Statistics" commit (`e154cea`) — restored, and improved beyond the original: the old toggle was cosmetic-only (toolbar stayed visible, content stayed editable regardless of tab). Now `editor.setEditable(mobileTab !== "preview")` makes Preview an actual read view, and the toolbar hides on mobile while previewing (`hidden md:flex`). Desktop is unaffected since the toggle bar itself is `md:hidden`. Resources tab (from the original "Write / Preview / Resources" scope) still not built.

## 33. Resource Sidebar

Currently: resources listed via `TopicResourceList`, inserted via a dropdown picker — not a persistent sidebar.

- Convert to persistent sidebar with one-click insertion (ties into #6 Resource Node)

## 34. Drag-and-Drop Reordering — PARTIALLY DONE (correcting a stale entry)

This entry was stale — it said "not present, depends on #10" for all four (sections/images/activities/resources), but that was never fully true:

- **Images/resources** — already done, and not actually dependent on #10 at all: `resource-node.tsx`'s drag handle + `moveResourceChip()` (delete-at-source, insert-at-target in one transaction) was built under **#6**, operating on raw ProseMirror positions rather than anything section-related. Verified with a position-math test in both directions (`tests/resource-chip-reorder.test.ts`) — forward and backward drags both preserve the other chips' relative order correctly.
- **Sections** — done now via #10 (see its entry above).
- **Activities** — still not present. "Activity"/"Homework" are the Callout node (#17) pre-set to those `calloutType`s, and `callout-node.tsx` has no drag handle or reorder logic at all — reordering one today means cut/paste. This is the one real gap left in #34's original scope.

Remaining: add the same handle + move-transaction pattern from `resource-node.tsx` to `callout-node.tsx` (or promote Callout to a child of the new `section` node's drag mechanism, since a section already carries its whole content as a unit — reordering a callout _within_ a section body is the more precise ask here).

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
2. ~~#2/#3 toolbar + lists, #9 floating menu, #29 shortcuts~~ — DONE
3. ~~#6/#7 resource cards + drag-drop upload~~ — DONE
4. ~~#4 tables~~ — DONE. ~~#5 images~~ — DONE. ~~#25 code blocks~~ — DONE (editor + published-view parity)
5. ~~#8 slash commands, #17 callouts~~ — DONE. #15 learning objectives SUSPENDED, skip
6. ~~#13 autosave~~ — DONE. ~~#28 word stats~~ — DONE. ~~#12 resizable panes~~ — NOT NEEDED (no split pane exists post-migration)
7. ~~#10 block-based editing~~ — V1 DONE (see status above for what's deferred). ~~#34 images/resources~~ — already done under #6, verified. #34 activities (Callout drag handle) — NEXT
8. Everything else (#20–24, #26, #27, #30–37) — lower priority, mostly additive

## Before building, verify these already exist

- #14 Version History → `NoteVersionDiff.tsx`
- #35 Presentation Mode → `NoteSlideView.tsx`
- #24 Audio embedding → existing upload resource type may already cover this
