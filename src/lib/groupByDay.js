import { formatDayHeading } from "./formatDateTime";

// Buckets an already date-sorted list of items into consecutive same-day
// groups, each carrying the heading it should render under ("Today",
// "Tomorrow", or a written-out date). Assumes `items` is sorted by date —
// callers already sort by starts_at, so this just walks it once.
export function groupByDay(items, getDate, now = new Date()) {
  const groups = [];
  let current = null;
  let currentKey = null;

  for (const item of items) {
    const date = new Date(getDate(item));
    const key = date.toDateString();
    if (key !== currentKey) {
      current = { key, heading: formatDayHeading(date, now), items: [] };
      groups.push(current);
      currentKey = key;
    }
    current.items.push(item);
  }

  return groups;
}
