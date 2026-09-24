import type { MouseEvent } from "react";

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
