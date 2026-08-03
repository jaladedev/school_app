"use client";

import { useState } from "react";

// Kept intentionally curated rather than pulling in a full Unicode emoji
// dataset (thousands of entries, most never relevant to a school note) --
// these categories cover what a teacher actually reaches for: reactions,
// classroom/people, and common subject-matter icons (science, sports,
// art, reading) for annotating notes and activities.
const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    icon: "😀",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "🙃",
      "😉",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😋",
      "😛",
      "🤔",
      "🤨",
      "😐",
      "😴",
      "🥳",
      "🤯",
    ],
  },
  {
    label: "Gestures",
    icon: "👍",
    emojis: [
      "👍",
      "👎",
      "👏",
      "🙌",
      "🙏",
      "✋",
      "👌",
      "🤞",
      "✌️",
      "🤟",
      "👋",
      "💪",
      "👉",
      "👈",
      "👆",
      "👇",
      "☝️",
      "🫶",
      "🤝",
      "✊",
    ],
  },
  {
    label: "People",
    icon: "🧑‍🏫",
    emojis: [
      "🧑‍🏫",
      "👩‍🏫",
      "👨‍🏫",
      "🧑‍🎓",
      "👩‍🎓",
      "👨‍🎓",
      "🧑‍💻",
      "🧒",
      "🧑",
      "👧",
      "👦",
      "👶",
      "🧓",
      "🙋",
      "🙋‍♂️",
      "🙋‍♀️",
      "👥",
      "🫂",
    ],
  },
  {
    label: "Animals & Nature",
    icon: "🐶",
    emojis: [
      "🐶",
      "🐱",
      "🐭",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🦁",
      "🐮",
      "🐷",
      "🐸",
      "🐵",
      "🐧",
      "🦋",
      "🐢",
      "🌱",
      "🌳",
      "🌸",
      "🌞",
      "🌙",
      "⭐",
      "🌈",
      "🔥",
    ],
  },
  {
    label: "Food",
    icon: "🍎",
    emojis: [
      "🍎",
      "🍌",
      "🍊",
      "🍇",
      "🍓",
      "🍕",
      "🍔",
      "🍟",
      "🍿",
      "🍩",
      "🍪",
      "🎂",
      "🍰",
      "🍫",
      "☕",
      "🧃",
      "🍞",
      "🥐",
    ],
  },
  {
    label: "Activities",
    icon: "⚽",
    emojis: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🎾",
      "🏓",
      "🎯",
      "🎮",
      "🎲",
      "🧩",
      "🎨",
      "🎭",
      "🎬",
      "🎤",
      "🎧",
      "🎸",
      "🎹",
    ],
  },
  {
    label: "School & Objects",
    icon: "📚",
    emojis: [
      "📚",
      "📖",
      "✏️",
      "🖊️",
      "📝",
      "📐",
      "🔬",
      "🧪",
      "🧮",
      "💡",
      "🔑",
      "📌",
      "📎",
      "✂️",
      "📅",
      "⏰",
      "⏳",
      "🔔",
      "🎁",
      "🏆",
      "🥇",
      "🎓",
      "📊",
      "📈",
    ],
  },
  {
    label: "Symbols",
    icon: "✅",
    emojis: [
      "✅",
      "❌",
      "⭐",
      "🌟",
      "✨",
      "🔥",
      "💯",
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "⚠️",
      "❗",
      "❓",
      "➕",
      "➖",
      "🔁",
      "🔗",
    ],
  },
];

export function EmojiPicker({
  onSelect,
  className = "",
}: {
  onSelect: (emoji: string) => void;
  className?: string;
}) {
  const [activeCategory, setActiveCategory] = useState(0);
  const category = EMOJI_CATEGORIES[activeCategory];

  return (
    <div
      className={`w-72 overflow-hidden rounded-lg border border-rule bg-white shadow-lg ${className}`}
    >
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-rule bg-paper px-1.5 py-1">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            type="button"
            title={cat.label}
            onClick={() => setActiveCategory(i)}
            className={`shrink-0 rounded-md px-1.5 py-1 text-base hover:bg-white ${
              i === activeCategory ? "bg-white ring-1 ring-rule" : ""
            }`}
          >
            {cat.icon}
          </button>
        ))}
      </div>
      <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {category.emojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            onClick={() => onSelect(emoji)}
            className="rounded-md py-1 text-lg hover:bg-paper"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
