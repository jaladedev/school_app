"use client";

import { useState } from "react";

// Symbol names are given here rather than relying on a screen reader's
// own Unicode-name fallback (inconsistent across browsers/readers, and
// unhelpful for compound glyphs like "×10") -- same reasoning as the
// EmojiPicker's name map.
const CATEGORIES: { label: string; symbols: { char: string; name: string }[] }[] = [
  {
    label: "Maths",
    symbols: [
      { char: "±", name: "plus-minus" },
      { char: "×", name: "multiplication sign" },
      { char: "÷", name: "division sign" },
      { char: "≠", name: "not equal to" },
      { char: "≈", name: "approximately equal to" },
      { char: "≤", name: "less than or equal to" },
      { char: "≥", name: "greater than or equal to" },
      { char: "∞", name: "infinity" },
      { char: "√", name: "square root" },
      { char: "∑", name: "summation" },
      { char: "∏", name: "product" },
      { char: "∫", name: "integral" },
      { char: "∂", name: "partial derivative" },
      { char: "∆", name: "delta (change)" },
      { char: "∠", name: "angle" },
      { char: "°", name: "degree" },
      { char: "′", name: "prime (minutes)" },
      { char: "″", name: "double prime (seconds)" },
      { char: "∈", name: "element of" },
      { char: "∉", name: "not an element of" },
      { char: "⊂", name: "subset of" },
      { char: "∪", name: "union" },
      { char: "∩", name: "intersection" },
      { char: "→", name: "right arrow" },
      { char: "↔", name: "left-right arrow" },
    ],
  },
  {
    label: "Science",
    symbols: [
      { char: "α", name: "alpha" },
      { char: "β", name: "beta" },
      { char: "γ", name: "gamma" },
      { char: "λ", name: "lambda" },
      { char: "μ", name: "mu" },
      { char: "π", name: "pi" },
      { char: "ρ", name: "rho" },
      { char: "σ", name: "sigma" },
      { char: "θ", name: "theta" },
      { char: "Ω", name: "omega" },
      { char: "°C", name: "degrees Celsius" },
      { char: "°F", name: "degrees Fahrenheit" },
      { char: "×10", name: "times ten (exponent)" },
      { char: "²", name: "squared" },
      { char: "³", name: "cubed" },
      { char: "⁻", name: "superscript minus" },
      { char: "⁺", name: "superscript plus" },
      { char: "→", name: "right arrow" },
      { char: "⇌", name: "equilibrium arrows" },
      { char: "⇄", name: "reversible arrows" },
      { char: "♀", name: "female sign" },
      { char: "♂", name: "male sign" },
    ],
  },
  {
    label: "Greek",
    symbols: [
      { char: "α", name: "alpha" },
      { char: "β", name: "beta" },
      { char: "γ", name: "gamma" },
      { char: "δ", name: "delta" },
      { char: "ε", name: "epsilon" },
      { char: "ζ", name: "zeta" },
      { char: "η", name: "eta" },
      { char: "θ", name: "theta" },
      { char: "ι", name: "iota" },
      { char: "κ", name: "kappa" },
      { char: "λ", name: "lambda" },
      { char: "μ", name: "mu" },
      { char: "ν", name: "nu" },
      { char: "ξ", name: "xi" },
      { char: "ο", name: "omicron" },
      { char: "π", name: "pi" },
      { char: "ρ", name: "rho" },
      { char: "σ", name: "sigma" },
      { char: "τ", name: "tau" },
      { char: "υ", name: "upsilon" },
      { char: "φ", name: "phi" },
      { char: "χ", name: "chi" },
      { char: "ψ", name: "psi" },
      { char: "ω", name: "omega" },
      { char: "Γ", name: "capital gamma" },
      { char: "Δ", name: "capital delta" },
      { char: "Θ", name: "capital theta" },
      { char: "Λ", name: "capital lambda" },
      { char: "Ξ", name: "capital xi" },
      { char: "Π", name: "capital pi" },
      { char: "Σ", name: "capital sigma" },
      { char: "Φ", name: "capital phi" },
      { char: "Ψ", name: "capital psi" },
      { char: "Ω", name: "capital omega" },
    ],
  },
];

export function SymbolPicker({ onSelectAction }: { onSelectAction: (symbol: string) => void }) {
  const [category, setCategory] = useState(0);
  return (
    <div className="w-72 overflow-hidden rounded-lg border border-rule bg-white shadow-lg">
      <div
        role="tablist"
        aria-label="Symbol category"
        className="flex border-b border-rule bg-paper p-1"
      >
        {CATEGORIES.map((item, index) => (
          <button
            key={item.label}
            type="button"
            role="tab"
            aria-selected={index === category}
            aria-controls={`symbol-panel-${index}`}
            id={`symbol-tab-${index}`}
            onClick={() => setCategory(index)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${index === category ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`symbol-panel-${category}`}
        aria-labelledby={`symbol-tab-${category}`}
        className="grid grid-cols-6 gap-1 p-2"
      >
        {CATEGORIES[category].symbols.map((symbol, index) => (
          <button
            key={`${symbol.char}-${index}`}
            type="button"
            title={symbol.name}
            aria-label={symbol.name}
            onClick={() => onSelectAction(symbol.char)}
            className="rounded-md p-1.5 text-base text-ink hover:bg-marigold/20"
          >
            {symbol.char}
          </button>
        ))}
      </div>
    </div>
  );
}
