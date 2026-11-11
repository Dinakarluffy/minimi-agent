export interface DateRange {
  startDate: string; // ISO String (start of day, 00:00:00.000)
  endDate: string;   // ISO String (end of day, 23:59:59.999)
  label: string;
}

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function startOfDay(d: Date): Date {
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  return res;
}

function endOfDay(d: Date): Date {
  const res = new Date(d);
  res.setHours(23, 59, 59, 999);
  return res;
}

/**
 * Extracts date ranges from temporal natural language queries.
 * Evaluates specific dates (Month+Day, ISO, weekdays) before generic words (today, yesterday).
 */
export function parseTemporalExpression(text: string, referenceDate: Date = new Date()): DateRange | null {
  const clean = text.toLowerCase().trim();

  // 1. Specific Month + Day (e.g. "3 November", "November 3", "Nov 3rd", "3rd of Nov 2026")
  const datePattern = /\b(?:(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+(\d{4}))?|(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?)\b/;
  const monthDayMatch = clean.match(datePattern);

  if (monthDayMatch) {
    let day: number;
    let monthName: string;
    let year: number;

    if (monthDayMatch[1] && monthDayMatch[2]) {
      day = Number.parseInt(monthDayMatch[1], 10);
      monthName = monthDayMatch[2];
      year = monthDayMatch[3] ? Number.parseInt(monthDayMatch[3], 10) : referenceDate.getFullYear();
    } else {
      monthName = monthDayMatch[4];
      day = Number.parseInt(monthDayMatch[5], 10);
      year = monthDayMatch[6] ? Number.parseInt(monthDayMatch[6], 10) : referenceDate.getFullYear();
    }

    const monthIndex = MONTH_NAMES[monthName];
    if (monthIndex !== undefined && day >= 1 && day <= 31) {
      const parsedDate = new Date(year, monthIndex, day);
      if (!monthDayMatch[3] && !monthDayMatch[6] && parsedDate.getTime() > referenceDate.getTime()) {
        parsedDate.setFullYear(year - 1);
      }
      return {
        startDate: startOfDay(parsedDate).toISOString(),
        endDate: endOfDay(parsedDate).toISOString(),
        label: `${day} ${monthName} ${year}`,
      };
    }
  }

  // 2. ISO Date (e.g. 2026-11-03)
  const isoMatch = clean.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      return {
        startDate: startOfDay(d).toISOString(),
        endDate: endOfDay(d).toISOString(),
        label: isoMatch[0],
      };
    }
  }

  // 3. "since [weekday]" (e.g., "since Monday", "since last Tuesday")
  const sinceMatch = clean.match(/\bsince\s+(?:last\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/);
  if (sinceMatch) {
    const targetDay = DAY_NAMES[sinceMatch[1]];
    const d = new Date(referenceDate);
    let diff = (d.getDay() - targetDay + 7) % 7;
    if (diff === 0) diff = 7;
    d.setDate(d.getDate() - diff);
    return {
      startDate: startOfDay(d).toISOString(),
      endDate: endOfDay(referenceDate).toISOString(),
      label: `since ${sinceMatch[1]}`,
    };
  }

  // 4. "last [weekday]" or "on [weekday]" (e.g. "last Tuesday", "on Monday")
  const weekdayMatch = clean.match(/\b(?:last|on|this past)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/);
  if (weekdayMatch) {
    const targetDay = DAY_NAMES[weekdayMatch[1]];
    const d = new Date(referenceDate);
    const isExplicitLast = clean.includes("last");
    let diff = (d.getDay() - targetDay + 7) % 7;
    
    if (diff === 0) {
      diff = isExplicitLast ? 7 : 0;
    }
    
    d.setDate(d.getDate() - (diff === 0 ? 7 : diff));
    return {
      startDate: startOfDay(d).toISOString(),
      endDate: endOfDay(d).toISOString(),
      label: weekdayMatch[0].trim(),
    };
  }

  // 5. "yesterday"
  if (/\byesterday\b/.test(clean)) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - 1);
    return {
      startDate: startOfDay(d).toISOString(),
      endDate: endOfDay(d).toISOString(),
      label: "yesterday",
    };
  }

  // 6. "today" (lowest priority fallback)
  if (/\btoday\b/.test(clean)) {
    return {
      startDate: startOfDay(referenceDate).toISOString(),
      endDate: endOfDay(referenceDate).toISOString(),
      label: "today",
    };
  }

  return null;
}
