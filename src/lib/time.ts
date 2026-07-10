import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const IRISH_TIME_ZONE = "Europe/Dublin";

export function formatIrishDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: IRISH_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function formatIrishTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: IRISH_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(value))
    .replace(/\s?([ap])\.?m\.?/i, (_, marker: string) => ` ${marker.toUpperCase()}M`);
}

export function toIrishDateTimeInput(value: Date | string | null) {
  if (!value) return "";

  const zonedDate = toZonedTime(value, IRISH_TIME_ZONE);
  const year = zonedDate.getFullYear();
  const month = String(zonedDate.getMonth() + 1).padStart(2, "0");
  const day = String(zonedDate.getDate()).padStart(2, "0");
  const hours = String(zonedDate.getHours()).padStart(2, "0");
  const minutes = String(zonedDate.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function fromIrishDateTimeInput(value: string) {
  return fromZonedTime(value, IRISH_TIME_ZONE).toISOString();
}

export function toIrishTimeInput(value: Date | string | null) {
  if (!value) return "";
  return formatIrishTime(value);
}

export function fromIrishTimeInput(dateSource: Date | string, timeValue: string) {
  const normalizedTime = timeValue.trim().toUpperCase();
  const twelveHourMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  const twentyFourHourMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})$/);
  let hours: number;
  let minutes: string;

  if (twelveHourMatch) {
    hours = Number(twelveHourMatch[1]);
    minutes = twelveHourMatch[2];
    const meridiem = twelveHourMatch[3];

    if (hours < 1 || hours > 12) {
      throw new Error("Use a valid time like 09:30 AM.");
    }

    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  } else if (twentyFourHourMatch) {
    hours = Number(twentyFourHourMatch[1]);
    minutes = twentyFourHourMatch[2];
  } else {
    throw new Error("Use a valid time like 09:30 AM.");
  }

  if (hours < 0 || hours > 23 || Number(minutes) > 59) {
    throw new Error("Use a valid time like 09:30 AM.");
  }

  const zonedDate = toZonedTime(dateSource, IRISH_TIME_ZONE);
  const year = zonedDate.getFullYear();
  const month = String(zonedDate.getMonth() + 1).padStart(2, "0");
  const day = String(zonedDate.getDate()).padStart(2, "0");
  const paddedHours = String(hours).padStart(2, "0");

  return fromZonedTime(`${year}-${month}-${day}T${paddedHours}:${minutes}`, IRISH_TIME_ZONE).toISOString();
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
