import { useEffect, useRef, useState, type MouseEvent } from "react";
import { copyText } from "./clipboard";

type State = "idle" | "copied" | "failed";

const RESET_MS = 1600;

/** The hover-revealed clipboard button on a fenced code block, Logseq-style. */
export function CodeCopyButton({ text }: { text: string }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleClick = async (e: MouseEvent) => {
    // The surrounding block enters edit mode on mouseup (see BlockStatic's
    // handleMouseUp), so both events have to be stopped or clicking Copy would
    // also drop the block into the textarea — same reason the marker button
    // stops propagation on both.
    e.preventDefault();
    e.stopPropagation();
    setState((await copyText(text)) ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), RESET_MS);
  };

  const label =
    state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy code";

  return (
    <button
      type="button"
      className={`mn-code-copy${state === "copied" ? " is-copied" : ""}${
        state === "failed" ? " is-failed" : ""
      }`}
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={handleClick}
    >
      {state === "copied" ? (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M3 8.5l3.2 3.2L13 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <rect
            x="5.5"
            y="5.5"
            width="8"
            height="9"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M10.5 3.2A1.7 1.7 0 008.8 1.5H4.2A1.7 1.7 0 002.5 3.2v6.6a1.7 1.7 0 001.7 1.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
