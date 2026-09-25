// Mirrors server/src/vault/files.ts's journalIdFromDate/formatJournalTitle
// exactly, so a calendar-picked date's tab id/title match what the server
// would compute for the same date — the client only needs this so the tab
// has a correct label immediately, before the fetched doc's own title lands.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ordinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export function journalIdFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}_${m}_${d}`;
}

export function formatJournalTitle(date: Date): string {
  const day = date.getDate();
  return `${MONTHS[date.getMonth()]} ${day}${ordinalSuffix(day)}, ${date.getFullYear()}`;
}
