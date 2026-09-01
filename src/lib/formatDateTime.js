// Single source of truth for how dates and times are displayed across the
// app. Deliberately avoids toLocaleDateString/toLocaleString — those follow
// the device's locale, so the same activity would render as "9/6/2026" on
// one phone and "6.9.2026" on another. Everything here is built from raw
// date parts instead, so it looks the same everywhere.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDate(input) {
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTime(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// "Sat 5 Sep" or "Sat 5 Sep 2027" when the date falls outside the current year.
export function formatDateOnly(input, now = new Date()) {
  const d = toDate(input);
  if (!d) return "";
  const yearPart = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${yearPart}`;
}

// "Sat 5 Sep, 13:00" or "Sat 5 Sep 2027, 13:00" when the date falls outside
// the current year. 24-hour time throughout.
export function formatDateTime(input, now = new Date()) {
  const d = toDate(input);
  if (!d) return "";
  return `${formatDateOnly(d, now)}, ${formatTime(d)}`;
}

// "September 2026" — used for "member since" on profiles.
export function formatMonthYear(input) {
  const d = toDate(input);
  if (!d) return null;
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

// Chat-timestamp shorthand: "14:32" for today, "Yesterday 14:32" for
// yesterday, and "Sat 5 Sep" (no time) for anything older.
export function formatChatTimestamp(input, now = new Date()) {
  const d = toDate(input);
  if (!d) return "";
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (dayDiff === 0) return formatTime(d);
  if (dayDiff === 1) return `Yesterday ${formatTime(d)}`;
  return formatDateOnly(d, now);
}
