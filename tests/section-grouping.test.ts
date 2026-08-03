// @vitest-environment jsdom
//
// Regression test for a real bug found while restoring #10 (block-based
// editing): dispatching the section-grouping transaction *synchronously*
// inside the editor's `onCreate` callback was silently discarded --
// `tr.docChanged` reported true, but the editor's state reverted to the
// flat, ungrouped doc right after, with no error surfaced anywhere. This
// only showed up on preexisting notes (new/empty notes have nothing to
// group, so the bug was invisible there). Deferring the same dispatch by
// one microtask fixes it reliably -- see the onCreate comment in
// NoteEditor.tsx for why.
import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { Section, groupIntoSections } from "@/lib/tiptap/section-node";

const SAMPLE_NOTE = `# Photosynthesis

## Introduction

Plants convert sunlight into energy through photosynthesis.

## The process

1. Light absorption
2. Water splitting
3. Carbon fixation

## Summary

This is how plants make food.
`;

function sectionCount(editor: Editor) {
  return editor.state.doc.content.content.filter((n) => n.type.name === "section").length;
}

describe("section grouping (#10)", () => {
  it("groupIntoSections itself produces one section per heading", () => {
    const editor = new Editor({
      extensions: [StarterKit, Section, Markdown.configure({ html: false })],
      content: SAMPLE_NOTE,
      // @ts-expect-error provided by the Markdown extension
      contentType: "markdown",
    });
    const grouped = groupIntoSections(editor.schema, editor.state.doc);
    const count = grouped.content.content.filter((n) => n.type.name === "section").length;
    expect(count).toBe(4); // # title + 3x ## headings
  });

  it("regression: dispatching synchronously inside onCreate must NOT be used", () => {
    let editor!: Editor;
    editor = new Editor({
      extensions: [StarterKit, Section, Markdown.configure({ html: false })],
      content: SAMPLE_NOTE,
      // @ts-expect-error provided by the Markdown extension
      contentType: "markdown",
      onCreate({ editor: created }) {
        const grouped = groupIntoSections(created.schema, created.state.doc);
        const tr = created.state.tr.replaceWith(0, created.state.doc.content.size, grouped.content);
        created.view.dispatch(tr);
      },
    });
    // Documents the bug: this is 0, not 4, when dispatched synchronously.
    expect(sectionCount(editor)).toBe(0);
  });

  it("fix: deferring the dispatch to the next animation frame groups the doc correctly", async () => {
    let editor!: Editor;
    editor = new Editor({
      extensions: [StarterKit, Section, Markdown.configure({ html: false })],
      content: SAMPLE_NOTE,
      // @ts-expect-error provided by the Markdown extension
      contentType: "markdown",
      onCreate({ editor: created }) {
        requestAnimationFrame(() => {
          const grouped = groupIntoSections(created.schema, created.state.doc);
          const tr = created.state.tr.replaceWith(
            0,
            created.state.doc.content.size,
            grouped.content
          );
          tr.setMeta("addToHistory", false);
          created.view.dispatch(tr);
        });
      },
    });
    // A timing sweep (0/5/16/30ms via setTimeout) found the real cutover
    // sits at a single frame, not any particular microtask count -- this
    // points to the view's own render/measure cycle, which is why the
    // fix uses requestAnimationFrame instead of a guessed setTimeout
    // delay. Two rAF hops here to be safely past that boundary.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(sectionCount(editor)).toBe(4);
  });
});
