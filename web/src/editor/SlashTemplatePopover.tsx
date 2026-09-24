import { useRef } from "react";
import { createPortal } from "react-dom";
import { usePopoverPosition } from "./usePopoverPosition";
import type { Template } from "./templates";

interface Props {
  x: number;
  top: number;
  bottom: number;
  matches: Template[];
  activeIndex: number;
  onSelect: (template: Template) => void;
  onHover: (index: number) => void;
}

export function SlashTemplatePopover({ x, top, bottom, matches, activeIndex, onSelect, onHover }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  usePopoverPosition(ref, { x, top, bottom }, [x, top, bottom, matches.length]);

  return createPortal(
    <div ref={ref} className="mn-tag-autocomplete" style={{ left: x, top: bottom + 4 }}>
      {matches.map((t, i) => (
        <div
          key={t.name}
          className={`mn-tag-autocomplete-item${i === activeIndex ? " active" : ""}`}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(t);
          }}
        >
          /{t.name}
        </div>
      ))}
    </div>,
    document.body,
  );
}
