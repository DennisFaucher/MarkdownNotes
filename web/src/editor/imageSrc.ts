/** Uploaded images are referenced as "../assets/<file>" (one level up from
 *  journals/ or pages/, per the vault's on-disk layout — see server/src/api/
 *  assets.ts), which resolves to "/assets/<file>" at the HTTP root, where
 *  `express.static(ASSETS_DIR)` serves it (server/src/index.ts). An absolute
 *  URL (an externally-hosted image someone pasted a markdown link to) or an
 *  already-rooted path is left untouched.
 *
 *  Shared by the on-screen renderer and the print/PDF document, which must
 *  resolve srcs identically or printed images come out blank. */
export function resolveImageSrc(src: string): string {
  if (/^(https?:)?\/\//.test(src) || src.startsWith("/")) return src;
  return `/${src.replace(/^(\.\.?\/)+/, "")}`;
}
