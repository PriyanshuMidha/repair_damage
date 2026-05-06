const INDIA_LOCALE = "en-GB";
export const INDIA_TIME_ZONE = "Asia/Kolkata";

export function formatDate(value: string | Date) {
  const parts = new Intl.DateTimeFormat(INDIA_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: INDIA_TIME_ZONE,
  }).formatToParts(toDate(value));

  return `${partValue(parts, "day")}/${partValue(parts, "month")}/${partValue(parts, "year")}`;
}

export function formatDateTime(value: string | Date) {
  const parts = new Intl.DateTimeFormat(INDIA_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: INDIA_TIME_ZONE,
  }).formatToParts(toDate(value));

  return `${partValue(parts, "day")}/${partValue(parts, "month")}/${partValue(parts, "year")}, ${partValue(parts, "hour")}:${partValue(parts, "minute")} ${partValue(parts, "dayPeriod")}`;
}

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}
