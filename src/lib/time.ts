export const IRISH_TIME_ZONE = "Europe/Dublin";

export function formatIrishDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: IRISH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function formatIrishTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: IRISH_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatDuration(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
}

export function entryDuration(startTime: Date | string, endTime?: Date | string | null) {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();

  return end - start;
}
