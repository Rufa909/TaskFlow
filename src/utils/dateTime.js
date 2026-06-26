export function toLocalDateTime(value, fallbackTime = "00:00:00") {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const time = fallbackTime.length === 5 ? `${fallbackTime}:00` : fallbackTime;

  return `${year}-${month}-${day}T${time}`;
}

export function parseLocalDate(value) {
  if (!value) return null;

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatLocalDate(value, options) {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString(undefined, options) : "";
}
