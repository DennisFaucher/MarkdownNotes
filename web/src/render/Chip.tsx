import type { MouseEvent, ReactNode } from "react";

interface ChipProps {
  label: string;
  kind: "tag" | "page";
  dataS: number;
  dataE: number;
  onActivate: () => void;
}

/** Left-click navigates; Alt+click falls through so the parent block enters edit mode.
 *  Both mousedown and mouseup stop propagation (not just mousedown) — the parent
 *  block's click-to-edit now runs on mouseup (to allow text-selection drags), so
 *  without this a chip click would navigate and then also re-enter edit mode. */
export function Chip({ label, kind, dataS, dataE, onActivate }: ChipProps) {
  const handleMouseDown = (e: MouseEvent) => {
    if (e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    onActivate();
  };
  const handleMouseUp = (e: MouseEvent) => {
    if (e.altKey) return;
    e.stopPropagation();
  };
  return (
    <span
      className={`mn-chip mn-chip-${kind}`}
      data-s={dataS}
      data-e={dataE}
      data-chip="true"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {label}
    </span>
  );
}

export function ExternalLinkSpan({ href, dataS, dataE }: { href: string; dataS: number; dataE: number }) {
  const handleMouseDown = (e: MouseEvent) => {
    if (e.altKey) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
  };
  const handleMouseUp = (e: MouseEvent) => {
    if (e.altKey) return;
    e.stopPropagation();
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mn-link"
      data-s={dataS}
      data-e={dataE}
      data-chip="true"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {href}
    </a>
  );
}

/** A markdown `[label](url)` link. Unlike ExternalLinkSpan the visible text is
 *  the label, not the URL, so the label arrives pre-rendered — that keeps tags,
 *  bold and nested links inside it working, same as inside bold/italic.
 *  data-chip marks the whole `[label](url)` range so a click resolves to its
 *  start rather than a caret offset inside the link. */
export function MarkdownLink({
  href,
  dataS,
  dataE,
  children,
}: {
  href: string;
  dataS: number;
  dataE: number;
  children: ReactNode;
}) {
  const handleMouseDown = (e: MouseEvent) => {
    if (e.altKey) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
  };
  const handleMouseUp = (e: MouseEvent) => {
    if (e.altKey) return;
    e.stopPropagation();
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mn-link mn-link-labeled"
      data-s={dataS}
      data-e={dataE}
      data-chip="true"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {children}
    </a>
  );
}
