import Link from "next/link";

import { cn } from "@/lib/utils";

type CalendarEvent = {
  id: string;
  title: string;
  event_date: string;
  attendance: "optional" | "mandatory";
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_TITLES_PER_DAY = 2;

function parseMonth(month: string | undefined): { year: number; monthIndex: number } {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNum] = month.split("-").map(Number);
    return { year, monthIndex: monthNum - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

function monthParam(year: number, monthIndex: number) {
  return `${year}-${(monthIndex + 1).toString().padStart(2, "0")}`;
}

export function EventCalendar({
  events,
  month,
}: {
  events: CalendarEvent[];
  month: string | undefined;
}) {
  const { year, monthIndex } = parseMonth(month);

  const firstOfMonth = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();

  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const event of events) {
    const date = new Date(event.event_date);
    if (date.getFullYear() === year && date.getMonth() === monthIndex) {
      const day = date.getDate();
      const bucket = eventsByDay.get(day) ?? [];
      bucket.push(event);
      eventsByDay.set(day, bucket);
    }
  }

  const prevMonth = monthIndex === 0 ? { year: year - 1, monthIndex: 11 } : { year, monthIndex: monthIndex - 1 };
  const nextMonth = monthIndex === 11 ? { year: year + 1, monthIndex: 0 } : { year, monthIndex: monthIndex + 1 };

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/events?view=calendar&month=${monthParam(prevMonth.year, prevMonth.monthIndex)}`}
          className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Prev
        </Link>
        <h2 className="text-lg font-semibold tracking-tight">{monthLabel}</h2>
        <Link
          href={`/events?view=calendar&month=${monthParam(nextMonth.year, nextMonth.monthIndex)}`}
          className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
        >
          Next →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-foreground/10 ring-1 ring-foreground/10">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-muted/50 px-1.5 py-1.5 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`blank-${i}`} className="min-h-20 bg-card" />;
          }
          const dayEvents = eventsByDay.get(day) ?? [];
          const shown = dayEvents.slice(0, MAX_TITLES_PER_DAY);
          const extra = dayEvents.length - shown.length;

          return (
            <div key={day} className="min-h-20 bg-card p-1 text-xs">
              <span className="text-muted-foreground">{day}</span>
              <div className="mt-0.5 flex flex-col gap-0.5">
                {shown.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events?view=list#event-${event.id}`}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 hover:bg-muted"
                    title={event.title}
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        event.attendance === "mandatory" ? "bg-destructive" : "bg-muted-foreground",
                      )}
                    />
                    <span className="truncate">{event.title}</span>
                  </Link>
                ))}
                {extra > 0 && (
                  <span className="px-1 text-muted-foreground">+{extra} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
