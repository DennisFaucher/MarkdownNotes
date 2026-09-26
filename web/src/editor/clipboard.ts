/** Copies `text` to the system clipboard, on plain HTTP as well as HTTPS.
 *
 *  `navigator.clipboard` is secure-context-only: it is simply absent on
 *  http://192.168.1.11:40039, which is the address the phone actually reads from.
 *  So the async API is only the HTTPS/localhost path — the execCommand fallback
 *  below is the one that runs in production, and it needs a real user gesture,
 *  which is why callers must invoke this from a click handler.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Blocked by permissions policy or an unfocused document — try the fallback.
    }
  }
  return copyViaExecCommand(text);
}

function copyViaExecCommand(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  // Kept on-screen but invisible: a negative `top` makes some mobile browsers
  // scroll the page to the element. fontSize stops iOS zooming on focus.
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.width = "1px";
  ta.style.height = "1px";
  ta.style.padding = "0";
  ta.style.border = "0";
  ta.style.opacity = "0";
  ta.style.fontSize = "12pt";
  document.body.appendChild(ta);
  let ok = false;
  try {
    ta.focus();
    ta.select();
    // Safari/iOS honour the range even where select() alone is ignored.
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}
