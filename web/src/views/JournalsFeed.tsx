import { useEffect, useRef } from "react";
import { useJournalStore } from "../state/useJournalStore";
import { DaySection } from "./DaySection";

export function JournalsFeed() {
  const dayIds = useJournalStore((s) => s.dayIds);
  const hasMore = useJournalStore((s) => s.hasMore);
  const loadMore = useJournalStore((s) => s.loadMore);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dayIds.length === 0) void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "800px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="mn-journals-feed">
      {dayIds.map((id) => (
        <DaySection key={id} dayId={id} />
      ))}
      {hasMore && <div ref={sentinelRef} className="mn-feed-sentinel" />}
    </div>
  );
}
