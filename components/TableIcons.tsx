// Compact 16x16 stroke icons for the table bubble-menu popover. Kept as
// plain inline SVG (no new icon-library dependency) since it's a small,
// fixed set specific to table actions -- not worth pulling in lucide-react
// or similar for eight glyphs.

import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function AddRowAboveIcon() {
  return (
    <Icon>
      <rect x="2" y="7" width="12" height="7" rx="1" />
      <path d="M4.5 10.5h7M4.5 12.5h7" />
      <path d="M8 1v4M6 3l2-2 2 2" />
    </Icon>
  );
}

export function AddRowBelowIcon() {
  return (
    <Icon>
      <rect x="2" y="2" width="12" height="7" rx="1" />
      <path d="M4.5 5h7M4.5 7h7" />
      <path d="M8 11v4M6 13l2 2 2-2" />
    </Icon>
  );
}

export function DeleteRowIcon() {
  return (
    <Icon>
      <rect x="2" y="5" width="12" height="6" rx="1" />
      <path d="M5.5 6.5l5 3M10.5 6.5l-5 3" />
    </Icon>
  );
}

export function AddColLeftIcon() {
  return (
    <Icon>
      <rect x="7" y="2" width="7" height="12" rx="1" />
      <path d="M10.5 4.5v7M8.5 4.5v7" />
      <path d="M1 8h4M3 6l-2 2 2 2" />
    </Icon>
  );
}

export function AddColRightIcon() {
  return (
    <Icon>
      <rect x="2" y="2" width="7" height="12" rx="1" />
      <path d="M5.5 4.5v7M7.5 4.5v7" />
      <path d="M15 8h-4M13 6l2 2-2 2" />
    </Icon>
  );
}

export function DeleteColIcon() {
  return (
    <Icon>
      <rect x="5" y="2" width="6" height="12" rx="1" />
      <path d="M6.5 5.5l3 5M9.5 5.5l-3 5" />
    </Icon>
  );
}

export function MergeCellsIcon() {
  return (
    <Icon>
      <rect x="2" y="2" width="5" height="12" rx="1" />
      <rect x="9" y="2" width="5" height="12" rx="1" />
      <path d="M6 8h4M8.5 5.5L11 8l-2.5 2.5M7.5 5.5L5 8l2.5 2.5" />
    </Icon>
  );
}

export function SplitCellIcon() {
  return (
    <Icon>
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <path d="M8 2v12" />
      <path d="M5.5 5.5L3 8l2.5 2.5M10.5 5.5L13 8l-2.5 2.5" />
    </Icon>
  );
}

export function HeaderRowIcon() {
  return (
    <Icon>
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <path d="M2 6h12" fill="currentColor" stroke="none" opacity="0.25" />
      <path d="M2 6h12M2 2h12v4H2z" />
    </Icon>
  );
}

export function DeleteTableIcon() {
  return (
    <Icon>
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <path d="M2 6h12M6 2v12" />
      <path d="M9.5 9.5l3 3M12.5 9.5l-3 3" strokeWidth="1.6" />
    </Icon>
  );
}
