import { useRef } from "react";
import { createPortal } from "react-dom";
import { usePopoverPosition } from "./usePopoverPosition";

interface Props {
  x: number;
  top: number;
  bottom: number;
  matches: string[];
  activeIndex: number;
  onSelect: (tag: string) => void;
  onHover: (index: number) => void;
}

export function TagAutocompletePopover({ x, top, bottom, matches, activeIndex, onSelect, onHover }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  usePopoverPosition(ref, { x, top, bottom }, [x, top, bottom, matches.length]);

  return createPortal(
    <div ref={ref} className="mn-tag-autocomplete" style={{ left: x, top: bottom + 4 }}>
      {matches.map((tag, i) => (
        <div
          key={tag}
          className={`mn-tag-autocomplete-item${i === activeIndex ? " active" : ""}`}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(tag);
          }}
        >
          #{tag}
        </div>
      ))}
    </div>,
    document.body,
  );
}
