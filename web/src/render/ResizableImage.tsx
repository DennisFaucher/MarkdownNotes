import { useRef, useState } from "react";

interface Props {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  onResize: (width: number, height: number) => void;
}

const MIN_WIDTH = 40;

function clientXOf(e: MouseEvent | TouchEvent): number {
  return "touches" in e ? e.touches[0].clientX : e.clientX;
}

/**
 * Renders an image with a drag handle at its bottom-right corner (visible on
 * hover on desktop; always visible on touch, where there's no hover to
 * reveal it — see the mobile media query in app.css) for resizing —
 * dragging scales both dimensions together using the image's natural aspect
 * ratio, matching Logseq's own image resize behavior. The result is only
 * persisted (via onResize) once the drag ends; while dragging, the size is
 * tracked in local state so nothing round-trips through a save on every
 * mouse-move/touchmove.
 */
export function ResizableImage({ src, alt, width, height, onResize }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null);

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    const startX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const startWidth = img.getBoundingClientRect().width;
    const startHeight = img.getBoundingClientRect().height;
    const aspect = img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : startWidth / startHeight || 1;

    function handleMove(ev: MouseEvent | TouchEvent) {
      const newWidth = Math.max(MIN_WIDTH, startWidth + (clientXOf(ev) - startX));
      setDragSize({ width: newWidth, height: newWidth / aspect });
    }
    function handleUp() {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleUp);
      setDragSize((current) => {
        if (current) onResize(Math.round(current.width), Math.round(current.height));
        return null;
      });
    }
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleUp);
  };

  const displayWidth = dragSize?.width ?? width;
  const displayHeight = dragSize?.height ?? height;

  return (
    <div className="mn-resizable-image" style={{ width: displayWidth }}>
      <img ref={imgRef} src={src} alt={alt} width={displayWidth} height={displayHeight} draggable={false} />
      <div className="mn-resizable-image-handle" onMouseDown={startDrag} onTouchStart={startDrag} />
    </div>
  );
}
