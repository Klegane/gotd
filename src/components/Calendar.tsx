"use client";

import React, { useMemo, useState } from "react";

type CalendarSession = {
  id: string;
  localDate: string;
  status: string;
};

type CalendarProps = {
  sessions: CalendarSession[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
};

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

export function Calendar({ sessions, selectedDate, onSelectDate }: CalendarProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [viewYear, setViewYear] = useState(() => Number.parseInt(today.slice(0, 4), 10));
  const [viewMonth, setViewMonth] = useState(() => Number.parseInt(today.slice(5, 7), 10) - 1);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, CalendarSession[]>();

    for (const session of sessions) {
      const existing = map.get(session.localDate);

      if (existing) {
        existing.push(session);
      } else {
        map.set(session.localDate, [session]);
      }
    }

    return map;
  }, [sessions]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric"
  });

  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);

    // Monday = 0, Sunday = 6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells: Array<{ date: string; day: number; inMonth: boolean }> = [];

    // Leading empty cells
    for (let i = 0; i < startDow; i++) {
      const d = new Date(viewYear, viewMonth, 1 - startDow + i);
      cells.push({ date: formatDate(d), day: d.getDate(), inMonth: false });
    }

    // Month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(viewYear, viewMonth, d);
      cells.push({ date: formatDate(date), day: d, inMonth: true });
    }

    // Trailing cells to fill last week
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(viewYear, viewMonth + 1, i);
        cells.push({ date: formatDate(d), day: d.getDate(), inMonth: false });
      }
    }

    return cells;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  return (
    <div id="session-calendar" className="calendar-widget" aria-labelledby="session-calendar-month">
      <div id="session-calendar-header" className="calendar-header">
        <button
          id="session-calendar-prev-month"
          type="button"
          className="calendar-nav"
          onClick={prevMonth}
          aria-label="Mes anterior"
        >
          &larr;
        </button>
        <span id="session-calendar-month" className="calendar-month-label">{monthLabel}</span>
        <button
          id="session-calendar-next-month"
          type="button"
          className="calendar-nav"
          onClick={nextMonth}
          aria-label="Mes siguiente"
        >
          &rarr;
        </button>
      </div>

      <div id="session-calendar-grid" className="calendar-grid">
        {DAY_LABELS.map((label) => (
          <span key={label} className="calendar-dow">
            {label}
          </span>
        ))}

        {days.map((cell) => {
          const isToday = cell.date === today;
          const isSelected = cell.date === selectedDate;
          const daySessions = sessionsByDate.get(cell.date);
          const sessionCount = daySessions?.length ?? 0;
          const hasSession = sessionCount > 0;
          const hasOpen = daySessions?.some((s) => s.status === "open");

          const classes = [
            "calendar-day",
            cell.inMonth ? "" : "outside",
            isToday ? "today" : "",
            isSelected ? "selected" : "",
            hasSession ? "has-session" : ""
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              id={`session-calendar-day-${cell.date}`}
              key={cell.date}
              type="button"
              className={classes}
              onClick={() => onSelectDate(cell.date)}
              aria-label={`${cell.date}${sessionCount > 0 ? `, ${sessionCount} ${sessionCount === 1 ? "sesión" : "sesiones"}` : ""}`}
            >
              <span>{cell.day}</span>
              {sessionCount > 1 ? (
                <span className={`calendar-session-count${hasOpen ? " open" : ""}`}>{sessionCount}</span>
              ) : hasSession ? (
                <span className={`calendar-dot${hasOpen ? " open" : ""}`} />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
