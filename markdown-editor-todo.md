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

## 14. Version History — DONE

Audited: view, compare, restore, and author/timestamp all present, split across two files rather than one.

- View previous versions + author/timestamp — the "Version history" list in `page.tsx`, pulling `full_name` off the `profiles` join (falls back to "Unknown author" if the join comes back empty) and `updated_at` via `toLocaleString()`
- Compare — `NoteVersionDiff.tsx`, word-level diff (`lib/diff.ts`) between any two versions, defaulting to the latest two so the most common comparison needs zero clicks
- Restore — `RestoreVersionButton.tsx`, one per version row, restores as a new draft (doesn't overwrite history) via `restoreTopicNoteVersion`
- Delete — `DeleteVersionButton.tsx`, one per version row (including the current version — deleting it just falls back to the next-highest remaining version, same as if it had never been saved). `deleteTopicNoteVersion` required its own migration (`2026_08_03b_topic_notes_delete_version.sql`) since `topic_notes` had no DELETE RLS policy at all before this. Refuses to delete the only remaining version. For resources attached to the version being deleted: `note_id` only records which version a resource was _uploaded under_, not every version whose content still references it (a save carries forward whatever `[[resource:UUID]]` markers were already in the content) — so each attached resource is checked against every surviving version's content and reassigned to one that still references it rather than deleted; only genuinely-unreferenced resources are hard-deleted (storage object + row)

## 15. Learning Objective Block — SUSPENDED

New — build as a TipTap custom Node (or slash-command insert):

- Learning objectives, Success criteria, Expected outcomes

**Suspended for now** (per request) — skip in the build order below until re-prioritized. Slash Commands (#8) should not list "Learning Objective" as a menu item while this is suspended, to avoid pointing at a block that doesn't exist.

## 16. Assessment Block — DONE

Currently: assessments are a separate system (`CreateAssessmentForm`, `GradeEntryForm`), not embeddable in notes.

**Decision: linked reference, not embedded.** Assessments stay a fully separate system — no question-type authoring (Multiple Choice/True-False/Fill-in-the-Blank/Matching/Essay) inside the note editor. What notes get instead is a reference/link to an existing assessment.

Built as `AssessmentChip` (`lib/tiptap/assessment-node.tsx`), the same pattern as #6's `ResourceChip` (`[[resource:UUID]]`) applied to a new `[[assessment:UUID]]` marker: a read-only card (title, type, term, max score, weight) rendered inline, with a link out to `/dashboard/teacher/grades/[assessmentId]` and a "Remove from note" action. No editing UI on the chip itself — nothing about the assessment is editable from here, only its title/id link.

- `NoteEditor.tsx`: registered the node, new `assessments` prop synced into `editor.storage.assessmentChip`, and a "Link assessment" toolbar dropdown next to "Insert resource." Note stats bar now also shows a "N linked assessments" count.
- `NoteWorkspace.tsx` / `page.tsx`: `assessments` threaded down from a new server query scoped to the topic's subject **and** class — not teacher. A topic has no `class_id` of its own (`curriculum_topics` is keyed by education_level/level_number, taught across every class at that level), so "matching class" resolves to every class at the topic's level for the school's current academic year (from `school_settings.current_academic_year`, the same source of truth the teacher notes list page already uses — not a calendar-derived guess). Any teacher's assessment for one of those classes is linkable, not just the current teacher's own, since a note is shared department content, not personal to whoever's editing it. The class each assessment belongs to is resolved into a plain `classLabel` string at the query site and shown in both the picker and the chip's card, since results can now span multiple classes/teachers for the same subject.
- **Published/student-facing content**: `TopicContent.tsx`'s `splitContentByMarkers` now strips `[[assessment:UUID]]` markers before rendering, rather than leaking them as literal `[[assessment:...]]` text (its `RESOURCE_MARKER` regex doesn't recognize this marker shape at all, so an unmatched marker would otherwise fall straight through into rendered text). `NoteSlideView.tsx` inherits this fix for free since it calls the same `splitContentByMarkers`. Assessment links are teacher-only for now — no student-facing assessment card rendering was built as part of this pass.

Not done as part of this pass, and out of scope for the "linked reference" decision as built: any question-type authoring, and any student-facing rendering of the linked assessment (currently invisible to students entirely, by design — see above).

## 17. Callout Components — DONE

Built as a TipTap custom Node (`lib/tiptap/callout-node.tsx`), exposed via slash command (#8) and a toolbar button. 8 types: Tip, Important, Warning, Remember, Definition, Example, Activity, Homework — each a colored card with an icon + type-switcher dropdown, real editable block content inside (`content: "block+"`, so paragraphs/lists/etc. all work, not just plain text).

Markdown round-trip via a `:::type ... :::` fence (Docusaurus/Obsidian-style admonition syntax) — a teacher who already knows that convention can type it by hand instead of going through the UI. Verified directly against markdown-it: nested formatting/lists parse correctly inside, surrounding content is untouched, and an unrecognized type falls through to plain text rather than producing a broken callout.

## 18. Better Mermaid Support — DONE

Renders live inline in the doc as a real `MermaidNodeView` (#0), not just a chip — inserted via the side-panel + `createMermaidResource`, edited in place via `updateMermaidResource` (hover-revealed "Edit" opens the same code+title+live-preview UI as creation, saves in place so the resource id and every `[[resource:ID]]` marker pointing at it stay valid).

- ✅ Live preview (already built)
- ✅ Starter templates: Flowchart, Mind Map, Timeline, Cycle, Org Chart, Sequence Diagram — a row of buttons above the code editor in the diagram panel (`DIAGRAM_TEMPLATES` in `NoteEditor.tsx`), each swapping in a short 2-4 node example a teacher can edit from rather than starting from a blank textarea or Mermaid's syntax quirks. "Cycle" isn't a real Mermaid diagram type — built as a `flowchart LR` that loops back to its first node, which is the standard way to express one.

## 19. Math Editor — DONE

Currently: LaTeX via `$...$`/`$$...$$` with toolbar buttons and KaTeX rendering, plus the previously-missing piece: a real _visual_ equation builder via MathLive (`math-field` custom element), with Visual/LaTeX mode toggle (localStorage-persisted, `note-editor-math-mode`) and a shared symbol palette (superscript, fractions, Greek letters, etc.) usable from either mode. LaTeX mode remains as the power-user fallback with its own live KaTeX preview.

**Bugs hit and fixed getting MathLive working:**

- **Font-loading console warning.** MathLive's default `fontsDirectory` resolves relative to its own JS chunk, which doesn't line up with Next's webpack output. Fixed by setting `MathfieldElement.fontsDirectory = "/mathlive-fonts"` right after the dynamic `import("mathlive")`, and added `scripts/copy-mathlive-fonts.js` (wired as `postinstall`) to copy the font files from `node_modules/mathlive/fonts` into `public/mathlive-fonts` automatically on every `npm install` — nothing to commit or remember manually, works the same locally and on Vercel.
- **`TypeError: this.mathfield is undefined` crash on autofocus.** `import("mathlive")` resolving only means the module ran and registered the custom element — MathLive's own internal controller on a given `<math-field>` instance still finishes initializing asynchronously after it's attached to the DOM. Calling `.focus()` in the same tick could hit it before that finished, crashing the node view. Fixed by waiting on `customElements.whenDefined("math-field")` before marking the field ready, deferring the autofocus call one frame via `requestAnimationFrame`, and wrapping all `.focus()`/`.executeCommand()` calls in try/catch as a last-resort safety net.
- **Field appeared to close after the first keystroke, take 1 (children fighting MathLive's own DOM).** An early version rendered `{draft}` as JSX children of `<math-field>`, and since `draft` updates on every `onInput`, React was overwriting the element's text content on every keystroke — fighting MathLive's own internal DOM management and resetting its editing state/cursor mid-type. Fixed by removing the children entirely; the existing `.value =` sync effect already handled pushing content in correctly.
- **Field appeared to close after the first keystroke, take 2 (phantom blur).** MathLive renders into a shadow root with its own internal element for capturing keystrokes; focus can shift briefly _within_ that shadow root while typing, which was leaking out as a spurious `blur` event on the host `<math-field>` even though focus never actually left the field — and committing on every raw blur was closing the popup. Fixed by deferring the blur handler one frame and checking `document.activeElement`/`field.shadowRoot?.activeElement` before treating it as a real blur.
- **Field appeared to close after the first keystroke, take 3 (root cause, after a rewrite added a portal-based popup + outside-click-to-close).** A "hard-stop native events so ProseMirror never sees them" effect added capture-phase `stopPropagation`/`stopImmediatePropagation` listeners directly on the `<math-field>` host for keydown/input/etc. Capture phase travels top-down and must pass through the host on its way _into_ the shadow root to reach MathLive's actual internal handler — so this stopped every keystroke before MathLive ever saw it, breaking its internal state on the first character typed. Turned out to be redundant on top of that: `stopEvent: () => true` was already set on the TipTap node view config, which tells ProseMirror to ignore all DOM events from this node view — the exact goal the capture-phase hack was trying to hand-roll. Fixed by deleting the hack entirely.

## 20. Emoji Picker — DONE

Built as `components/EmojiPicker.tsx`: 8 curated categories (Smileys, Gestures, People, Animals & Nature, Food, Activities, School & Objects, Symbols) — a hand-picked set rather than a full Unicode dataset, since most of the thousands of available emoji are never relevant to a school note.

- Toolbar button (😀) next to Table, opens a tabbed category + grid popover (same dropdown/outside-click-close pattern as the resource picker)
- Also reachable via slash command (`/emoji`), wired through `slashCommandBridge` same as Image/Video/Diagram
- Inserts as plain Unicode text (`insertContent`), not a custom node — round-trips through markdown with zero extra serialize/parse code needed

## 21. Symbol Picker — DONE

Built as `components/SymbolPicker.tsx`: a compact toolbar popover with curated Mathematics, Science, and Greek-letter tabs. Symbols insert directly at the cursor as Unicode text, so they round-trip through Markdown without a custom node or serializer.

## 22. Link Preview — DONE

Title, thumbnail, and description fetched server-side (`lib/linkPreview.ts`) and stored as a `link` resource — reusing the existing `link` resource type and its rendering path (`TopicContent.tsx`'s `case "link"`) rather than a separate node/schema.

- SSRF-guarded fetch: resolves and checks every hop's IP (including redirects, followed manually and re-checked one at a time rather than trusting `fetch`'s own auto-follow) against private/loopback/link-local ranges before requesting it, restricted to http(s), capped at 200KB read since og: tags are always in `<head>`
- "Add link" toolbar button + panel, a `/link` slash command, and paste-a-bare-URL auto-detection (only when the _entire_ clipboard payload is one URL, not a URL embedded in a sentence) — all three funnel into the same `createLinkResource`/`handleAddLinkPreview`
- Rendering: a real preview card (thumbnail + title + description + hostname) in `TopicResourceItem` — shared by the published view, Presentation Mode, and the editor's own resource-chip popover, so building it once in `TopicContent.tsx` covered all three. Falls back to the original bare-link rendering for a `link` resource with no fetched metadata (older resources predating this feature, or a page with no og: tags at all). The existing video-embed iframe branch (#23) is checked first and unaffected.
- "Refresh preview from URL" in the resource-edit popover for when the auto-fetched preview goes stale or fetched wrong the first time — separate action (`refreshLinkPreview`) from the generic title/file edit, since it touches fields (`description`, the og:image `file_url`) that edit never does
- One new column: `topic_resources.description` (migration `2026_08_03e_topic_resources_link_description.sql`) — title/content/file_url all reuse the columns `createVideoEmbedResource` already established for `link`-type resources

## 23. Video Embedding — DONE

YouTube and Vimeo HTTPS links can now be embedded from the note editor. They are stored as regular link resources and rendered through allowlisted provider iframe URLs; uploaded MP4/WebM videos remain available through the existing resource upload path.

## 24. Audio Embedding — DONE

Confirmed adequate: uploaded MP3/WAV/OGG resources render as lazy-loaded native audio players in editing, presentation, and published views, with a title and a failure state. No separate URL-embed route is needed for this resource type.

## 25. Code Blocks — DONE

Built via `@tiptap/extension-code-block-lowlight` (`lib/tiptap/code-block.tsx`), extended with a React node view: language selector (19 common languages via `lowlight`'s `common` bundle), Copy button with a brief "Copied!" confirmation, `github-dark` highlight.js theme. No custom markdown serializer needed — `CodeBlockLowlight` keeps the same `codeBlock` node name/attrs StarterKit's plain version used, and tiptap-markdown already serializes fenced blocks with a language info string by default.

Registered by disabling StarterKit's built-in `codeBlock: false` and adding the new extension alongside it (avoids double-registering the node name).

**Published-view parity, done as a follow-up:** the published note (`TopicContent.tsx`) and Presentation Mode (`NoteSlideView.tsx`, both render paths) previously fell back to `react-markdown`'s unstyled default `<pre><code>` for fenced blocks — a teacher's code block looked different once published than it did while writing. Fixed by wiring `rehype-highlight` + the same `github-dark` theme into both, and adding matching `.topic-prose pre`/`code` CSS (same dark background/radius/padding as the editor's node view) in `globals.css` so editing, presenting, and the published/student view all render identically.

## 26. Search & Replace — DONE

Built directly into `NoteEditor.tsx`: the toolbar's **Find** button (or Ctrl/Cmd+F) opens a compact find/replace panel with case-sensitive matching, a live match count, previous/next navigation with wraparound, single replacement, and replace-all. Matches are selected in the TipTap document without adding persistent marks or changing the note merely to display search results; replace-all runs in one backward-order ProseMirror transaction, so position changes are safe and the operation is one undo step. Escape closes the panel and returns focus to the editor. `tsc --noEmit` and `eslint` pass.

## 27. Spell Check — DONE (first pass)

Browser-native only, as scoped: `spellcheck` is a plain DOM attribute on the contentEditable node, so this is entirely a browser feature (Chrome/Firefox/Safari's own dictionary + red squiggly underlines, right-click for suggestions) rather than anything TipTap/ProseMirror-aware. Toggle lives in the existing reading & accessibility (Aa) menu (#37) alongside font size/high-contrast/dyslexia font, same localStorage-preference pattern, defaulting on. The one wrinkle: `editorProps.attributes` is only applied once at editor creation, unlike those other three toggles (plain CSS classes on a wrapper, so a re-render is enough) — toggling this after mount needs an explicit `editor.setOptions()` call reaching into the live contentEditable DOM node, careful to spread the existing `editorProps` first so `handlePaste` (image upload / link-preview paste) doesn't get silently dropped.

- Grammar suggestions (bigger lift — likely third-party service) still not present.

## 28. Word Statistics — DONE

Built via `@tiptap/extension-character-count` (words/characters) + custom `computeNoteStats()` in `NoteEditor.tsx` that walks the doc for headings/tables/images/resource chips, plus a rough reading-time estimate (words / 200 wpm).

## 29. Keyboard Shortcuts — DONE

TipTap ships common ones (Ctrl+B/I/U) by default — mostly free with migration.

- ✅ Ctrl+S (save draft)
- ✅ Ctrl+K (link) — opens the same prompt as the BubbleMenu link button
- ✅ Tab/Shift+Tab (indent) — fixed a real bug: when there's no list item to sink/lift into or table cell to move to, every extension's Tab handler correctly returns false, but nothing was calling preventDefault, so the keydown fell through to the browser's native focus-tabbing and jumped to the next toolbar/chip button. Added a catch-all `TabTrap` extension that absorbs Tab/Shift-Tab as a last resort so focus never escapes the editor.
- ✅ Ctrl/Cmd+/ (slash menu) — opens the existing filterable TipTap command menu from inside the editor; the `/` toolbar button provides a discoverable mouse equivalent.
- ✅ Shortcut hints in UI — toolbar titles now cover Undo/Redo, B/I/U, link, search, and slash commands; the Save draft control also shows Ctrl/Cmd+S.

## 30. Focus Mode — DONE

`NoteEditor.tsx` now has a toolbar focus-mode control. It opens the editor in a fixed, full-viewport distraction-free layer that covers the dashboard sidebar and navigation, hides the save/resource/formatting/search controls, and centers a wider reading-and-writing surface. An always-visible **Exit focus mode** button and Escape return to the normal editor; entering focus mode also returns keyboard focus to the document, so writing can continue immediately. Ctrl/Cmd+S remains available through the existing global shortcut.

## 31. Fullscreen Editing — DONE

The editor toolbar now has a real browser Fullscreen toggle (`requestFullscreen`), with an exit state and normal Escape support. Focus mode remains the separate distraction-free dashboard overlay.

## 32. Mobile Optimization — DONE

Write/Preview tabs (`mobileTab` state, tab buttons, `md:hidden` toggle bar) were deleted with no replacement in the "Word Statistics" commit (`e154cea`) — restored, and improved beyond the original: the old toggle was cosmetic-only (toolbar stayed visible, content stayed editable regardless of tab). Now `editor.setEditable(mobileTab !== "preview")` makes Preview an actual read view, and the toolbar hides on mobile while previewing (`hidden md:flex`). Desktop is unaffected since the toggle bar itself is `md:hidden`.

**Resources tab (final gap from the original "Write / Preview / Resources" scope) — done.** `NoteEditor`'s mobile tab state (`"write" | "preview" | "resources"`) is now controllable from its parent (falls back to internal state if unwired, so it still works standalone) and NoteWorkspace lifts it, since the actual Resources content is `ResourceSidebar` — a sibling of `NoteEditor`, not a child. Selecting the tab hides `NoteEditor`'s own toolbar+content area on mobile (same `hidden md:block` pattern as the existing Write/Preview toggle, without unmounting the TipTap instance) while `ResourceSidebar` becomes visible in its place; at `lg`+ the sidebar stays visible side-by-side regardless of tab, unchanged from before.

## 33. Resource Sidebar — DONE

`ResourceSidebar.tsx` replaces the old below-the-editor `TopicResourceUpload` + `TopicResourceList` pairing with a persistent sidebar (`NoteWorkspace.tsx`). Clicking a resource inserts it at the cursor in one click via `editorRef.current.insertResource(resource)` (ties into #6's Resource Node), instead of going through the toolbar's "Insert resource" dropdown. Also handles drag-and-drop + file-picker upload directly in the sidebar, reusing `NoteEditor`'s own `uploadFiles`/`uploadDroppedFiles` pipeline rather than duplicating it. Takes the live, session-merged resource list (via `NoteWorkspace`'s `onResourcesChange`), so a resource created this session (new upload, new Mermaid diagram) shows up immediately without a page reload.

## 34. Drag-and-Drop Reordering — DONE

This entry was stale twice over — it originally said "not present, depends on #10" for all four (sections/images/activities/resources), which was already wrong; a later pass narrowed the gap to just Activities, which is now also done:

- **Images/resources** — done, and not actually dependent on #10 at all: `resource-node.tsx`'s drag handle was built under **#6**. Verified with a position-math test in both directions (`tests/resource-chip-reorder.test.ts`).
- **Sections** — done via #10.
- **Activities** — done. `callout-node.tsx` has the same `dragArmed`-gated handle + `draggable: true` + `stopEvent: dragAwareStopEvent` pattern as `section-node.tsx`/`resource-node.tsx` (drag handle button, armed on mousedown, disarmed on mouseup/dragend so a plain click can't leave it draggable). No separate `moveResourceChip`-style transaction needed for any of the three — all three now ride native ProseMirror node dragging instead of a hand-rolled onDragStart/onDragOver/onDrop pipeline (see the comment above `ResourceChipView` in `resource-node.tsx` for why the hand-rolled version was replaced).

## 35. Presentation Mode — DONE

`NoteSlideView.tsx` already covers this fully — confirmed by audit, nothing new needed:

- Splits note content into slides on every top-level `## ` heading (sub-headings stay inside their parent slide), with an optional intro slide for content before the first heading
- Real fullscreen (`requestFullscreen`), auto-scales slide content to fit the viewport (measures natural height at a fixed logical width, derives a uniform scale, clamps between 0.5x–2.25x, falls back to scroll if a slide is too dense to shrink further)
- Keyboard nav (←/→, PageUp/PageDown, Escape to exit fullscreen) + Prev/Next buttons + clickable dot indicator
- Resource markers (`[[resource:ID]]`) render inline per-slide via the same `splitContentByMarkers`/`TopicResourceItem` the published note view uses, with any note-wide unreferenced resources trailing on the last slide
- Wired into `NoteWorkspace.tsx` as an Edit/Present toggle — Present is disabled until the note has been saved at least once (deliberately shows the last-_saved_ content, not live unsaved editor state, matching how the rest of the page already treats saves as the source of truth), and the classroom `BellTimer` sits above the slides in Present mode specifically since that's what actually gets projected

## 36. Student Engagement Components

Not present. New build — Polls, Quick questions, Reflection prompts, Classroom activities (likely custom Nodes, same pattern as #15/#17).

## 37. Accessibility Features — DONE

- ✅ Keyboard block reordering (`lib/tiptap/block-reorder.ts`, `BlockReorderShortcuts`) — Section/Callout/CodeBlock/MathBlock could previously only be reordered by dragging the handle, no keyboard/screen-reader path at all. Alt+Up / Alt+Down (and Mod-Alt- variants, since plain Alt+Arrow is taken by some browsers/WMs for tab/history nav) now swaps the block containing the cursor with its previous/next sibling — walks up from the selection to the _shallowest_ ancestor of a draggable type (so a cursor in a paragraph inside a Callout inside a Section moves the Section, not the Callout), builds a `replaceWith` swap over the two sibling ranges, and re-resolves the selection into the moved block afterward rather than leaving it wherever ProseMirror's default position-mapping lands. Drag-handle `title` attributes on all four node types updated to mention the shortcut for discoverability.
- ✅ Keyboard ResourceChip reordering (same file, `moveResourceChip`) — closes the gap the entry above used to note. ResourceChip is inline (lives inside a paragraph, selected as a `NodeSelection`, not a text cursor "inside" it), so it gets its own Alt+Left/Alt+Right command rather than folding into the block-swap logic: select a chip (click it or its handle) and Alt+Left/Right moves it past its previous/next _chip_ sibling, skipping over whatever plain content (usually just a space) separates chips in the paragraph rather than swapping with that separator — a naive adjacent-sibling swap would, for the common "chip, space, chip" layout, swap the chip with the space and need two presses to actually pass the next chip. Covered by `tests/block-reorder.test.ts` (forward, backward, left/right boundary, and "selection isn't a chip" no-op cases), alongside a new test for the block-swap command. All three ResourceChip drag-handle variants' `title`/`aria-label` updated to mention the shortcut instead of stating keyboard reordering wasn't available.
- ✅ Drag-handle labeling for screen readers — all six drag handles (Section, Callout, CodeBlock, MathBlock, and ResourceChip's three view variants) rendered only a decorative "⠿" glyph with a `title` attribute; `title` isn't reliably announced by screen readers, and the raw glyph reads as gibberish when it is picked up. Added `aria-label` to all six.
- ✅ Toolbar/menu screen-reader pass — the main toolbar's ~40 icon-only buttons (Undo, Bold, Align, Callout, Insert table, etc.) and the table bubble menu's buttons (#9) had a `title` but no `aria-label`; added one to every button mirroring its `title` text, plus `aria-pressed` on the Bold/Italic/Underline bubble-menu toggles so a screen reader announces active state, not just the label. The slash-command menu (`slash-command.tsx`) had working Arrow/Enter keyboard nav but no ARIA to go with it — added `role="listbox"`/`role="option"`/`aria-selected` so the current keyboard selection is actually announced, and `role="status"` on the empty-results state. `EmojiPicker`/`SymbolPicker` had no labeling at all on ~150 emoji buttons and ~75 symbol buttons beyond a raw-glyph `title` (and for symbols, the tooltip literally repeated the glyph -- "±" as its own tooltip has no screen-reader value); both now carry a curated name per glyph (`"thumbs up"`, `"plus-minus"`, etc.) as `title`+`aria-label`, and their category-switcher tabs got proper `role="tablist"`/`role="tab"`/`aria-selected`/`role="tabpanel"` wiring instead of plain unlabeled buttons.
- ✅ Adjustable font size / high contrast / dyslexia-friendly font — new "Aa" menu at the end of the toolbar (`a11yMenuOpen` state in `NoteEditor.tsx`). Font size is a `--note-font-size` CSS var read by `.topic-prose`'s own `font-size` (so headings/code/etc. that are already sized in em/rem scale off it automatically, rather than needing a size rule per element); high contrast and dyslexia font are `a11y-high-contrast`/`a11y-dyslexia-font` classes on the note container (`app/globals.css`). All three are a per-browser reading preference, not note content, so they're read from/written to `localStorage`, not the note's saved markdown. Dyslexia font falls back to Comic Sans in the CSS stack (`OpenDyslexic, "Atkinson Hyperlegible", "Comic Sans MS", sans-serif`) since neither purpose-built dyslexia font is bundled with the app and there's no font-CDN network access from this build; Comic Sans is a reasonable stand-in per available readability research and is close to universally present as a system font already.
- ✅ Focus-visible states — turned out to already be handled globally (`app/globals.css`'s `:focus-visible { outline: 2px solid #f2b705; ... }`), not a gap; the one `outline: none` in the file is scoped to `.topic-prose .ProseMirror` itself, which is deliberate (the text caret is the focus indicator for a contenteditable surface, not an outline box). No change needed, just confirmed rather than left as an open item.
- ✅ Landmark regions — the editor had no ARIA structure at all beyond individual buttons: the ProseMirror contenteditable itself had no role, the main toolbar was an unlabeled `<div>`, and the two bubble-menu toolbars (table, text formatting) were too. Added `role="textbox"` + `aria-multiline` + `aria-label="Note content"` via `editorProps.attributes`, and `role="toolbar"` + a descriptive `aria-label` on all three toolbar containers.
- **Corrected from an earlier stale pass of this entry:** it previously claimed a gap in "table row/column reordering" needing a keyboard path. That was inaccurate -- there's no table row/column drag-reorder feature at all currently, mouse or keyboard (`Table.configure({ resizable: true })` only enables column _resizing_). Building that is a net-new feature, not an accessibility fix for something that already has a mouse-only path, so it's out of scope here; if wanted, it'd belong under #4 (Tables) as new work, not this entry.
- ✅ Color-contrast audit, done properly (computed WCAG ratios, not spot-checked) — `ink`/`ink-soft` on `white`/`paper` all clear 7:1+, `leaf` on `leaf-soft` clears 5.4:1, `clay` on `white` clears 5.3:1, all well past AA's 4.5:1 text minimum. Found one real failure: `marigold-dark` (#C98F00) is only 2.83:1 on white -- fails even the loosest 3:1 UI-component threshold. It's used as text in ~28 files app-wide (mostly as a decorative/accent color -- icons, thin borders, badge tints -- where that may be an acceptable tradeoff, not evaluated here since it's outside the editor), but three of those uses are directly in the editor's scope: `NoteEditor.tsx`'s "Unsaved changes" indicator and the "Awaiting grading" badges on `student/grades` and `parent/grades` (added earlier this session). Rather than silently redefine the shared `marigold-dark` token (which would ripple across all ~28 files without review) or hardcode a one-off hex in three different places, added a new `marigold-text` token (`#956A00`, 4.84:1 on white / 4.60:1 on paper -- passes AA on both) specifically for amber-colored _text_, and pointed those three spots at it. The app-wide `marigold-dark`-as-text pattern elsewhere is a real finding worth a decision but belongs in `todo.md` (main project todo), not here -- it's not an editor-scoped issue. Also checked `rule` (#D9D3C4) on white for the hairline dividers: 1.49:1, fails, but that's a purely decorative border, not text or a required UI-component boundary (WCAG 1.4.11 doesn't apply), so left alone rather than redesigning the notebook-rule aesthetic on a contrast technicality.
- ✅ Dyslexia-friendly font, now actually bundled rather than just referenced in a fallback stack — the earlier version of this entry said neither Atkinson Hyperlegible nor OpenDyslexic could be loaded because "there's no font-CDN access from this build," which conflated a sandbox tool restriction (my own dev environment's network allowlist) with an actual constraint of the deployed app -- which already loads all its other fonts (Baloo 2, Inter, IBM Plex Mono) via a Google Fonts `@import` in `globals.css`. Added Atkinson Hyperlegible to that same import; it's genuinely loaded now, not aspirational. OpenDyslexic stays ahead of it in the CSS fallback stack as a "if the reader happens to have it installed locally" option since it isn't on Google Fonts at all (independent distribution only), and Comic Sans remains the final fallback if even Google Fonts is unreachable.

## 38. Lesson Plan Review UI — DONE

Not really an editor feature (no TipTap/node-view work involved) — logged here mainly for cross-reference, since the review action operates on the same `topic_notes` rows this whole file is about. Full detail lives in `todo.md`'s "Lesson Plan approval (HOD workflow)" entry, follow-up note.

- ✅ Note editor page (`/dashboard/teacher/notes/[topicId]`) previously only showed a moderation-status badge (pending/approved/rejected) with no way to act on it — an eligible reviewer had to trust the list page and click back and forth. `LessonPlanReviewButtons` now renders inline next to that badge, gated server-side by the same eligibility check as the list page (admin, or the HOD of that topic's subject).
- ✅ Admins could already approve/reject anything server-side (`assertCanModerateTopicNote` bypasses the HOD/subject check for `role === "admin"`) but had no reachable UI for it — the only review surfaces lived on teacher-facing routes. New `/dashboard/admin/lesson-plans` page: school-wide pending queue, same list/pagination pattern as the existing Grade Moderation admin page, added to the admin nav.

---

## Suggested build order

1. ~~#0 Core TipTap migration~~ — DONE (see status above; round-trip testing and the Mermaid NodeView are the two loose ends)
2. ~~#2/#3 toolbar + lists, #9 floating menu, #29 shortcuts~~ — DONE
3. ~~#6/#7 resource cards + drag-drop upload~~ — DONE
4. ~~#4 tables~~ — DONE. ~~#5 images~~ — DONE. ~~#25 code blocks~~ — DONE (editor + published-view parity)
5. ~~#8 slash commands, #17 callouts~~ — DONE. #15 learning objectives SUSPENDED, skip
6. ~~#13 autosave~~ — DONE. ~~#28 word stats~~ — DONE. ~~#12 resizable panes~~ — NOT NEEDED (no split pane exists post-migration)
7. ~~#10 block-based editing~~ — V1 DONE (see status above for what's deferred). ~~#34 drag-and-drop reordering~~ — DONE, all four (sections/images/resources/activities) confirmed working, no gaps left.
8. ~~#30 Focus Mode~~ — DONE (upstream). ~~#31 Fullscreen Editing~~ — DONE (upstream). ~~#37 Accessibility~~ — DONE (this session: keyboard reordering for all draggable node types including ResourceChip, screen-reader labeling across the toolbar/bubble-menus/slash-command/EmojiPicker/SymbolPicker, adjustable font size/high contrast/dyslexia font, and ARIA landmark roles -- see #37's entry above for the full breakdown and what's still open for a future pass). ~~#33 Resource Sidebar~~ — DONE (upstream, `ResourceSidebar.tsx`). ~~#32 Mobile Optimization~~ — DONE (this session: Resources tab, the last gap from the original Write/Preview/Resources scope). ~~#16 Assessment Block~~ — DONE (this session: `AssessmentChip`, linked-not-embedded per the recorded product decision). Everything else (#20–24, #26, #27, #35, #36) is lower priority and additive -- new Node types or standalone features rather than gaps in what's shipped. No single obvious NEXT among them; pick based on what's actually being asked for next rather than working strictly down the list.

## Before building, verify these already exist

- #14 Version History → `NoteVersionDiff.tsx` — audited; view/compare were done, restore + author display + delete have now been added
- #35 Presentation Mode → `NoteSlideView.tsx` — audited; already fully covers this, nothing built
- #24 Audio embedding → existing upload resource type may already cover this
- Popover containment audit → `clampPopoverToEditor()` (`lib/tiptap/popover-position.ts`) was already wired into inline math, the slash-command menu, and the emoji picker; the table/format `BubbleMenu`s already had their own `flip`/`shift` boundary options set to `noteContainerRef`. The resource chip preview popover (`resource-node.tsx`, `max-w-[90vw]` — measures the browser viewport, not the editor's own narrower column) was the one gap, now wired to the same `clampPopoverToEditor()` util, re-clamping on `editing`/`confirmingRemove` since its content height changes. The "Insert resource" toolbar dropdown was checked and left alone — it lives above `.topic-prose`, not nested in arbitrary inline content, so it's a different, lower-risk case than the others.
