const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function journalFilename(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}_${m}_${d}.md`;
}

export function journalDateFromFilename(filename: string): Date | null {
  const m = /^(\d{4})_(\d{2})_(\d{2})\.md$/.exec(filename);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function ordinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export function formatJournalTitle(date: Date): string {
  const day = date.getDate();
  return `${MONTHS[date.getMonth()]} ${day}${ordinalSuffix(day)}, ${date.getFullYear()}`;
}

export function journalIdFromDate(date: Date): string {
  return journalFilename(date).replace(/\.md$/, "");
}

/** Rejects titles that can't safely become a single filename component. */
export function isSafePageTitle(title: string): boolean {
  if (title.length === 0 || title.length > 200) return false;
  if (title === "." || title === "..") return false;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(title)) return false;
  return true;
}

export function pageTitleToFilename(title: string): string {
  if (!isSafePageTitle(title)) throw new Error(`unsafe page title: ${title}`);
  return `${title.replace(/\//g, "___")}.md`;
}

export function filenameToPageTitle(filename: string): string {
  return filename.replace(/\.md$/, "").replace(/___/g, "/");
}
