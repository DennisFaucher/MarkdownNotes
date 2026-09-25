import { useEffect, useState } from "react";
import { formatJournalTitle, journalIdFromDate } from "../editor/journalDate";
import { useTabsStore } from "../state/useTabsStore";
import { useUiStore } from "../state/useUiStore";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function CalendarPicker() {
  const open = useUiStore((s) => s.calendarOpen);
  const closeCalendar = useUiStore((s) => s.closeCalendar);
  const openTab = useTabsStore((s) => s.openTab);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Reset to the current month each time it's reopened, rather than
  // remembering wherever it was last left — picking a distant date is a
  // one-off jump, not a browsing session worth resuming later.
  useEffect(() => {
    if (open) {
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const pickDate = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    openTab({ kind: "journal-day", id: journalIdFromDate(date), title: formatJournalTitle(date) });
    closeCalendar();
  };

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const numDays = daysInMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: numDays }, (_, i) => i + 1),
  ];
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString(undefined, { month: "long" });

  return (
    <div
      className="mn-search-overlay"
      onMouseDown={closeCalendar}
      onKeyDown={(e) => e.key === "Escape" && closeCalendar()}
    >
      <div className="mn-calendar-box" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mn-calendar-header">
          <button className="mn-calendar-nav" onClick={goPrevMonth} aria-label="Previous month">
            ‹
          </button>
          <button className="mn-calendar-title" onClick={goToday} title="Jump to today">
            {monthLabel} {viewYear}
          </button>
          <button className="mn-calendar-nav" onClick={goNextMonth} aria-label="Next month">
            ›
          </button>
        </div>
        <div className="mn-calendar-weekdays">
          {WEEKDAYS.map((w) => (
            <div key={w} className="mn-calendar-weekday">
              {w}
            </div>
          ))}
        </div>
        <div className="mn-calendar-grid">
          {cells.map((day, i) =>
            day === null ? (
              <div key={i} className="mn-calendar-cell mn-calendar-cell-empty" />
            ) : (
              <button
                key={i}
                className={`mn-calendar-cell${isSameDay(new Date(viewYear, viewMonth, day), today) ? " mn-calendar-today" : ""}`}
                onClick={() => pickDate(day)}
              >
                {day}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
