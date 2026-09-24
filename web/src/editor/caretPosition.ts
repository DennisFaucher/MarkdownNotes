const MIRROR_PROPERTIES = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "wordSpacing",
  "textIndent",
] as const;

/**
 * Viewport-relative pixel coordinates of a caret offset inside a <textarea>
 * — used to position the tag-autocomplete dropdown right under what's being
 * typed. Textareas have no native API for this, so this uses the standard
 * "mirror div" trick: an offscreen div styled identically to the textarea
 * (same font, padding, width, so it wraps text the same way), with a marker
 * span inserted at the target offset — the span's rendered position is the
 * caret's position.
 */
export function getCaretCoordinates(textarea: HTMLTextAreaElement, position: number): { top: number; left: number; height: number } {
  const div = document.createElement("div");
  const style = window.getComputedStyle(textarea);
  for (const prop of MIRROR_PROPERTIES) {
    div.style[prop] = style[prop];
  }
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.top = "0";
  div.style.left = "-9999px";
  document.body.appendChild(div);

  div.textContent = textarea.value.slice(0, position);
  const marker = document.createElement("span");
  marker.textContent = textarea.value.slice(position) || ".";
  div.appendChild(marker);

  const textareaRect = textarea.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();

  const coords = {
    top: textareaRect.top + (markerRect.top - divRect.top) - textarea.scrollTop,
    left: textareaRect.left + (markerRect.left - divRect.left) - textarea.scrollLeft,
    height: markerRect.height,
  };

  document.body.removeChild(div);
  return coords;
}
