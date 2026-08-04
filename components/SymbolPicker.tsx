"use client";

import { useState } from "react";

const CATEGORIES = [
  {
    label: "Maths",
    symbols: [
      "±",
      "×",
      "÷",
      "≠",
      "≈",
      "≤",
      "≥",
      "∞",
      "√",
      "∑",
      "∏",
      "∫",
      "∂",
      "∆",
      "∠",
      "°",
      "′",
      "″",
      "∈",
      "∉",
      "⊂",
      "∪",
      "∩",
      "→",
      "↔",
    ],
  },
  {
    label: "Science",
    symbols: [
      "α",
      "β",
      "γ",
      "λ",
      "μ",
      "π",
      "ρ",
      "σ",
      "θ",
      "Ω",
      "°C",
      "°F",
      "×10",
      "²",
      "³",
      "⁻",
      "⁺",
      "→",
      "⇌",
      "⇄",
      "♀",
      "♂",
    ],
  },
  {
    label: "Greek",
    symbols: [
      "α",
      "β",
      "γ",
      "δ",
      "ε",
      "ζ",
      "η",
      "θ",
      "ι",
      "κ",
      "λ",
      "μ",
      "ν",
      "ξ",
      "ο",
      "π",
      "ρ",
      "σ",
      "τ",
      "υ",
      "φ",
      "χ",
      "ψ",
      "ω",
      "Γ",
      "Δ",
      "Θ",
      "Λ",
      "Ξ",
      "Π",
      "Σ",
      "Φ",
      "Ψ",
      "Ω",
    ],
  },
];

export function SymbolPicker({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [category, setCategory] = useState(0);
  return (
    <div className="w-72 overflow-hidden rounded-lg border border-rule bg-white shadow-lg">
      <div className="flex border-b border-rule bg-paper p-1">
        {CATEGORIES.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setCategory(index)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${index === category ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1 p-2">
        {CATEGORIES[category].symbols.map((symbol, index) => (
          <button
            key={`${symbol}-${index}`}
            type="button"
            title={symbol}
            onClick={() => onSelect(symbol)}
            className="rounded-md p-1.5 text-base text-ink hover:bg-marigold/20"
          >
            {symbol}
          </button>
        ))}
      </div>
    </div>
  );
}
