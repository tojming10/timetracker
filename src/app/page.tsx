"use client";

import { ClipboardEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Download, ExternalLink, Pencil, Play, Square, Trash2 } from "lucide-react";
import {
  entryDuration,
  formatDuration,
  formatIrishDate,
  fromIrishTimeInput,
  IRISH_TIME_ZONE,
  toIrishTimeInput,
} from "@/lib/time";

type TimeEntry = {
  id: string;
  startTime: string;
  endTime: string | null;
  event: string;
  description: string | null;
  link: string | null;
  photoPath: string | null;
};

type DraftEntry = {
  id: string;
  startTime: string;
  endTime: null;
  event: string;
  description: string | null;
  link: string | null;
  photoPath: string | null;
  pending?: boolean;
};

const emptyForm = {
  event: "",
  description: "",
  link: "",
  photoPath: "",
};

const defaultEventOptions = ["WICA 2026", "GA UK 2026", "NPA 2026"];
const eventOptionsStorageKey = "time-tracker-event-options";
const removedEventOptions = ["video proofing"];

type ScreenshotDraft = {
  file: File;
  previewUrl: string;
};

async function readJsonResponse<T>(response: Response): Promise<T & { message?: string }> {
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return { message: await response.text() } as T & { message?: string };
}

function isPendingEntry(entry: TimeEntry | DraftEntry) {
  return "pending" in entry && entry.pending === true;
}

function isRemovedEventOption(value: string) {
  return removedEventOptions.includes(value.trim().toLowerCase());
}

function cleanEventOptions(options: string[]) {
  return Array.from(new Set(options.map((option) => option.trim()).filter((option) => option && !isRemovedEventOption(option))));
}

export default function Home() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [draftEntry, setDraftEntry] = useState<DraftEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingTimes, setEditingTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null);
  const [screenshotDraft, setScreenshotDraft] = useState<ScreenshotDraft | null>(null);
  const [entryScreenshotDrafts, setEntryScreenshotDrafts] = useState<Record<string, ScreenshotDraft>>({});
  const [isSavingScreenshot, setIsSavingScreenshot] = useState(false);
  const [savingEntryScreenshotId, setSavingEntryScreenshotId] = useState<string | null>(null);
  const [eventOptions, setEventOptions] = useState(() => {
    if (typeof window === "undefined") return defaultEventOptions;

    const savedOptions = window.localStorage.getItem(eventOptionsStorageKey);
    if (!savedOptions) return defaultEventOptions;

    try {
      const parsedOptions = JSON.parse(savedOptions);
      if (Array.isArray(parsedOptions)) {
        return cleanEventOptions([...defaultEventOptions, ...parsedOptions.filter(Boolean)]);
      }
    } catch {
      return defaultEventOptions;
    }

    return defaultEventOptions;
  });
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [editingScreenshotIds, setEditingScreenshotIds] = useState<Record<string, boolean>>({});

  const fetchEntries = useCallback(async () => {
    try {
      const response = await fetch("/api/entries");
      const data = await readJsonResponse<TimeEntry[]>(response);

      if (!response.ok || !Array.isArray(data)) {
        setMessage(data.message ?? "Could not load entries.");
        return;
      }

      setEntries(data);
      setEventOptions((current) => cleanEventOptions([...current, ...data.map((entry) => entry.event).filter(Boolean)]));
      if (!draftEntry) {
        setActiveId(data.find((entry: TimeEntry) => !entry.endTime)?.id ?? null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load entries.");
    }
  }, [draftEntry]);

  useEffect(() => {
    const loadEntries = window.setTimeout(() => {
      void fetchEntries();
    }, 0);
    const ticker = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(loadEntries);
      window.clearInterval(ticker);
    };
  }, [fetchEntries]);

  const activeEntry = useMemo(
    () => draftEntry ?? entries.find((entry) => entry.id === activeId) ?? entries.find((entry) => !entry.endTime) ?? null,
    [activeId, draftEntry, entries],
  );

  useEffect(() => {
    return () => {
      if (screenshotDraft) {
        URL.revokeObjectURL(screenshotDraft.previewUrl);
      }
    };
  }, [screenshotDraft]);

  async function uploadScreenshotFile(file: File) {
    if (!file) return null;

    const data = new FormData();
    data.append("photo", file);
    const response = await fetch("/api/upload", { method: "POST", body: data });
    const result = await readJsonResponse<{ path?: string }>(response);

    if (!response.ok || !result.path) {
      throw new Error(result.message ?? "Screenshot upload failed.");
    }

    return result.path;
  }

  async function confirmScreenshot() {
    if (!screenshotDraft) return;

    setIsSavingScreenshot(true);
    try {
      const path = await uploadScreenshotFile(screenshotDraft.file);
      setForm((current) => ({ ...current, photoPath: path ?? "" }));
      setMessage("Screenshot saved.");
      removeScreenshotDraft();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Screenshot upload failed.";
      setMessage(`${errorMessage} The timer is still safe; you can add the screenshot later.`);
    } finally {
      setIsSavingScreenshot(false);
    }
  }

  function removeScreenshotDraft() {
    setScreenshotDraft((current) => {
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return null;
    });
  }

  async function pasteScreenshot(event: ClipboardEvent<HTMLDivElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));
    const file = imageItem?.getAsFile();

    if (!file) {
      setMessage("No screenshot image found on the clipboard.");
      return;
    }

    event.preventDefault();
    setScreenshotDraft((current) => {
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return {
        file,
        previewUrl: URL.createObjectURL(file),
      };
    });
    setForm((current) => ({ ...current, photoPath: "" }));
    setMessage("Screenshot pasted. Confirm it to attach it.");
  }

  async function pasteEntryScreenshot(event: ClipboardEvent<HTMLDivElement>, entryId: string) {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));
    const file = imageItem?.getAsFile();

    if (!file) {
      setMessage("No screenshot image found on the clipboard.");
      return;
    }

    event.preventDefault();
    setEntryScreenshotDrafts((current) => {
      const existing = current[entryId];
      if (existing) URL.revokeObjectURL(existing.previewUrl);

      return {
        ...current,
        [entryId]: {
          file,
          previewUrl: URL.createObjectURL(file),
        },
      };
    });
    setMessage("Screenshot pasted. Confirm it to attach it to this entry.");
  }

  function removeEntryScreenshotDraft(entryId: string) {
    setEntryScreenshotDrafts((current) => {
      const existing = current[entryId];
      if (existing) URL.revokeObjectURL(existing.previewUrl);

      const next = { ...current };
      delete next[entryId];
      return next;
    });
  }

  function closeEntryScreenshotEditor(entryId: string) {
    removeEntryScreenshotDraft(entryId);
    setEditingScreenshotIds((current) => {
      const next = { ...current };
      delete next[entryId];
      return next;
    });
  }

  async function confirmEntryScreenshot(entry: TimeEntry | DraftEntry) {
    if (isPendingEntry(entry)) return;
    const draft = entryScreenshotDrafts[entry.id];
    if (!draft) return;

    setSavingEntryScreenshotId(entry.id);
    try {
      const photoPath = await uploadScreenshotFile(draft.file);
      const response = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoPath }),
      });
      const updated = await readJsonResponse<TimeEntry>(response);

      if (!response.ok) {
        setMessage(updated.message ?? "Could not attach screenshot.");
        return;
      }

      setEntries((current) => current.map((currentEntry) => (currentEntry.id === entry.id ? updated : currentEntry)));
      removeEntryScreenshotDraft(entry.id);
      setEditingScreenshotIds((current) => {
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
      setMessage(entry.photoPath ? "Screenshot updated." : "Screenshot attached.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not attach screenshot.");
    } finally {
      setSavingEntryScreenshotId(null);
    }
  }

  async function startTimer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (screenshotDraft) {
      setMessage("Confirm or delete the pasted screenshot before starting the timer.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    const optimisticEntry: DraftEntry = {
      id: `draft-${crypto.randomUUID()}`,
      startTime: new Date().toISOString(),
      endTime: null,
      event: form.event.trim(),
      description: form.description.trim() || null,
      link: form.link.trim() || null,
      photoPath: form.photoPath || null,
      pending: true,
    };
    setDraftEntry(optimisticEntry);
    setActiveId(optimisticEntry.id);

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startTime: optimisticEntry.startTime,
        }),
      });
      const entry = await readJsonResponse<TimeEntry>(response);

      if (!response.ok || !entry.id) {
        setDraftEntry(null);
        setMessage(entry.message ?? "Could not start timer.");
        return;
      }

      setEntries((current) => [entry, ...current]);
      setActiveId(entry.id);
      setDraftEntry(null);
      setForm(emptyForm);
    } catch (error) {
      setDraftEntry(null);
      setMessage(error instanceof Error ? error.message : "Could not start timer.");
    } finally {
      setIsSaving(false);
    }
  }

  async function stopTimer(id: string) {
    const response = await fetch(`/api/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endTime: new Date().toISOString() }),
    });
    const updated = await readJsonResponse<TimeEntry>(response);

    if (!response.ok) {
      setMessage(updated.message ?? "Could not stop timer.");
      return;
    }

    setEntries((current) => current.map((entry) => (entry.id === id ? updated : entry)));
    setActiveId(null);
  }

  async function updateEntryTimes(entry: TimeEntry | DraftEntry) {
    if (isPendingEntry(entry)) return;

    const values = editingTimes[entry.id];
    if (!values?.startTime) {
      setMessage("Start time is required.");
      return;
    }

    const startTime = fromIrishTimeInput(entry.startTime, values.startTime);
    const endTime = values.endTime ? fromIrishTimeInput(entry.startTime, values.endTime) : null;

    if (endTime && new Date(endTime).getTime() < new Date(startTime).getTime()) {
      setMessage("End time cannot be earlier than start time.");
      return;
    }

    const response = await fetch(`/api/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime, endTime }),
    });
    const updated = await readJsonResponse<TimeEntry>(response);

    if (!response.ok) {
      setMessage(updated.message ?? "Could not update times.");
      return;
    }

    setEntries((current) => current.map((currentEntry) => (currentEntry.id === entry.id ? updated : currentEntry)));
    setEditingTimes((current) => {
      const next = { ...current };
      delete next[entry.id];
      return next;
    });
    setMessage("Times updated.");
  }

  async function updateEntryEvent(entry: TimeEntry | DraftEntry, eventName: string) {
    if (isPendingEntry(entry)) return;

    const response = await fetch(`/api/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: eventName }),
    });
    const updated = await readJsonResponse<TimeEntry>(response);

    if (!response.ok) {
      setMessage(updated.message ?? "Could not update event.");
      return;
    }

    setEntries((current) => current.map((currentEntry) => (currentEntry.id === entry.id ? updated : currentEntry)));
    setMessage("Event updated.");
  }

  async function deleteEntry(id: string) {
    const response = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    const result = await readJsonResponse<{ ok?: boolean }>(response);

    if (!response.ok) {
      setMessage(result.message ?? "Could not delete entry.");
      return;
    }

    setEntries((current) => current.filter((entry) => entry.id !== id));
    if (activeId === id) setActiveId(null);
    setDeleteTarget(null);
  }

  function saveNewEventOption() {
    const nextEventName = newEventName.trim();
    if (!nextEventName) {
      setMessage("Enter an event name first.");
      return;
    }

    if (isRemovedEventOption(nextEventName)) {
      setMessage("That event option has been removed.");
      return;
    }

    const nextOptions = cleanEventOptions([...eventOptions, nextEventName]);
    setEventOptions(nextOptions);
    window.localStorage.setItem(eventOptionsStorageKey, JSON.stringify(nextOptions));
    setForm((current) => ({ ...current, event: nextEventName }));
    setNewEventName("");
    setIsAddingEvent(false);
    setMessage("Event saved.");
  }

  const visibleEntries = draftEntry ? [draftEntry, ...entries] : entries;

  const totalToday = visibleEntries
    .filter((entry) => formatIrishDate(entry.startTime) === formatIrishDate(new Date()))
    .reduce((sum, entry) => sum + entryDuration(entry.startTime, entry.endTime), 0);

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#20231f]">
      <div className="mx-auto flex w-full max-w-none flex-col gap-6 px-3 py-5 sm:px-5 lg:px-6">
        <header className="flex flex-col gap-3 border-b border-[#ded9cd] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-[#697066]">Irish time zone: {IRISH_TIME_ZONE}</p>
            <h1 className="text-3xl font-semibold tracking-normal text-[#20231f]">Time Tracker</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-[#d8d2c5] bg-white px-4 py-2">
              <p className="text-xs uppercase text-[#697066]">Today</p>
              <p className="font-mono text-lg">{formatDuration(totalToday)}</p>
            </div>
            <a
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#245c4f] px-4 text-sm font-semibold text-white hover:bg-[#1d4c42]"
              href="/api/export"
            >
              <Download size={17} />
              Export Excel
            </a>
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-[340px_1fr]">
          <form onSubmit={startTimer} className="rounded-md border border-[#ded9cd] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New task</h2>
              {activeEntry ? (
                <span className="rounded-md bg-[#e3f1ec] px-3 py-1 font-mono text-sm text-[#245c4f]">
                  {formatDuration(now - new Date(activeEntry.startTime).getTime())}
                </span>
              ) : null}
            </div>

            <label className="block text-sm font-medium">Event</label>
            <select
              className="mt-2 h-11 w-full rounded-md border border-[#cfc8ba] bg-white px-3 outline-none focus:border-[#245c4f]"
              value={form.event}
              onChange={(event) => {
                if (event.target.value === "__add_event__") {
                  setIsAddingEvent(true);
                  return;
                }
                setForm({ ...form, event: event.target.value });
              }}
            >
              <option value="">Select event</option>
              {eventOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              <option value="__add_event__">Add new event...</option>
            </select>
            {isAddingEvent ? (
              <div className="mt-2 flex gap-2">
                <input
                  className="h-10 min-w-0 flex-1 rounded-md border border-[#cfc8ba] px-3 outline-none focus:border-[#245c4f]"
                  value={newEventName}
                  onChange={(event) => setNewEventName(event.target.value)}
                  placeholder="New event"
                />
                <button
                  className="h-10 rounded-md bg-[#245c4f] px-3 text-sm font-semibold text-white hover:bg-[#1d4c42]"
                  type="button"
                  onClick={saveNewEventOption}
                >
                  Save
                </button>
              </div>
            ) : null}

            <label className="mt-4 block text-sm font-medium">Description</label>
            <textarea
              className="mt-2 min-h-28 w-full resize-y rounded-md border border-[#cfc8ba] px-3 py-3 outline-none focus:border-[#245c4f]"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Optional notes"
            />

            <label className="mt-4 block text-sm font-medium">Link</label>
            <input
              className="mt-2 h-11 w-full rounded-md border border-[#cfc8ba] px-3 outline-none focus:border-[#245c4f]"
              value={form.link}
              onChange={(event) => setForm({ ...form, link: event.target.value })}
              placeholder="https://..."
            />

            <label className="mt-4 block text-sm font-medium">Screenshot</label>
            <div
              className="mt-2 flex min-h-32 cursor-text items-center justify-center rounded-md border border-dashed border-[#b9b09f] bg-[#fbfaf7] px-3 py-4 text-center text-sm text-[#697066] outline-none focus:border-[#245c4f]"
              onPaste={pasteScreenshot}
              tabIndex={0}
              role="textbox"
              aria-label="Paste screenshot"
            >
              {screenshotDraft ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="max-h-48 w-full rounded-md object-contain"
                  src={screenshotDraft.previewUrl}
                  alt="Pasted screenshot preview"
                />
              ) : (
                "Paste a recent screenshot here"
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {screenshotDraft ? (
                <>
                  <button
                    className="h-9 rounded-md bg-[#245c4f] px-3 text-sm font-semibold text-white hover:bg-[#1d4c42] disabled:opacity-60"
                    type="button"
                    onClick={confirmScreenshot}
                    disabled={isSavingScreenshot}
                  >
                    Confirm screenshot
                  </button>
                  <button
                    className="h-9 rounded-md border border-[#d8d2c5] px-3 text-sm font-semibold hover:bg-[#f2eee5]"
                    type="button"
                    onClick={removeScreenshotDraft}
                  >
                    Delete screenshot
                  </button>
                </>
              ) : null}
              {form.photoPath ? (
                <a className="inline-flex items-center gap-1 text-sm text-[#245c4f]" href={form.photoPath} target="_blank">
                  <Camera size={15} />
                  View screenshot
                </a>
              ) : null}
            </div>

            {message ? <p className="mt-4 rounded-md bg-[#fff3d6] px-3 py-2 text-sm text-[#75540f]">{message}</p> : null}

            <button
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#20231f] px-4 font-semibold text-white hover:bg-[#343930] disabled:opacity-60"
              disabled={isSaving}
            >
              <Play size={17} />
              Start timer
            </button>
            {activeEntry && !isPendingEntry(activeEntry) ? (
              <button
                type="button"
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#245c4f] px-4 font-semibold text-white hover:bg-[#1d4c42]"
                onClick={() => stopTimer(activeEntry.id)}
              >
                <Square size={17} />
                Stop timer
              </button>
            ) : null}
          </form>

          <section className="overflow-hidden rounded-md border border-[#ded9cd] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#ece7dc] px-5 py-4">
              <h2 className="text-lg font-semibold">Entries</h2>
              <p className="text-sm text-[#697066]">{visibleEntries.length} total</p>
            </div>

            <div>
              <table className="w-full table-fixed border-collapse text-left text-xs xl:text-sm">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[12%]" />
                  <col className="w-[17%]" />
                  <col className="w-[8%]" />
                  <col className="w-[9%]" />
                  <col className="w-[16%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className="bg-[#f2eee5] text-xs uppercase text-[#5f655d]">
                  <tr>
                    {["Date", "Start Time", "End Time", "Event", "Description", "Duration", "Link", "Screenshot", ""].map((column) => (
                      <th key={column} className="px-2 py-3 font-semibold xl:px-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map((entry) => (
                    <tr key={entry.id} className="border-t border-[#ece7dc] align-top">
                      <td className="break-words px-2 py-3 xl:px-3">{formatIrishDate(entry.startTime)}</td>
                      <td className="px-2 py-3 xl:px-3">
                        <input
                          className="h-9 w-full rounded-md border border-[#d8d2c5] px-2 font-mono text-xs"
                          type="text"
                          value={editingTimes[entry.id]?.startTime ?? toIrishTimeInput(entry.startTime)}
                          disabled={isPendingEntry(entry)}
                          placeholder="09:30 AM"
                          onChange={(event) =>
                            setEditingTimes((current) => ({
                              ...current,
                              [entry.id]: {
                                startTime: event.target.value,
                                endTime: current[entry.id]?.endTime ?? toIrishTimeInput(entry.endTime),
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="px-2 py-3 xl:px-3">
                        <input
                          className="h-9 w-full rounded-md border border-[#d8d2c5] px-2 font-mono text-xs"
                          type="text"
                          value={editingTimes[entry.id]?.endTime ?? toIrishTimeInput(entry.endTime)}
                          disabled={isPendingEntry(entry)}
                          placeholder={entry.endTime ? "05:00 PM" : "Running"}
                          onChange={(event) =>
                            setEditingTimes((current) => ({
                              ...current,
                              [entry.id]: {
                                startTime: current[entry.id]?.startTime ?? toIrishTimeInput(entry.startTime),
                                endTime: event.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="break-words px-2 py-3 font-medium xl:px-3">
                        <select
                          className="h-9 w-full rounded-md border border-[#d8d2c5] bg-white px-2 text-xs outline-none focus:border-[#245c4f]"
                          value={eventOptions.includes(entry.event) ? entry.event : ""}
                          disabled={isPendingEntry(entry)}
                          onChange={(event) => updateEntryEvent(entry, event.target.value)}
                        >
                          <option value="">No event</option>
                          {eventOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        {isPendingEntry(entry) ? (
                          <span className="ml-2 rounded-md bg-[#fff3d6] px-2 py-1 text-xs text-[#75540f]">Saving</span>
                        ) : null}
                      </td>
                      <td className="break-words px-2 py-3 text-[#4f554d] xl:px-3">{entry.description}</td>
                      <td className="break-words px-2 py-3 font-mono xl:px-3">{formatDuration(entryDuration(entry.startTime, entry.endTime))}</td>
                      <td className="break-words px-2 py-3 xl:px-3">
                        {entry.link ? (
                          <a className="inline-flex max-w-full items-center gap-1 break-all text-[#245c4f]" href={entry.link} target="_blank">
                            Open <ExternalLink size={14} />
                          </a>
                        ) : null}
                      </td>
                      <td className="px-2 py-3 xl:px-3">
                        {isPendingEntry(entry) ? null : (
                          <div className="w-full">
                            {entry.photoPath ? (
                              <div className="mb-2 flex items-center gap-2">
                                <a className="inline-flex max-w-full min-w-0 items-center gap-1 break-all text-[#245c4f]" href={entry.photoPath} target="_blank">
                                  Screenshot <Camera size={14} />
                                </a>
                                <button
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#d8d2c5] hover:bg-[#f2eee5]"
                                  onClick={() => setEditingScreenshotIds((current) => ({ ...current, [entry.id]: true }))}
                                  title="Update screenshot"
                                >
                                  <Pencil size={14} />
                                </button>
                              </div>
                            ) : null}
                            {!entry.photoPath || editingScreenshotIds[entry.id] ? (
                              <div
                                className="flex min-h-20 cursor-text items-center justify-center rounded-md border border-dashed border-[#b9b09f] bg-[#fbfaf7] px-2 py-3 text-center text-xs text-[#697066] outline-none focus:border-[#245c4f]"
                                onPaste={(event) => pasteEntryScreenshot(event, entry.id)}
                                tabIndex={0}
                                role="textbox"
                                aria-label="Paste screenshot for entry"
                              >
                                {entryScreenshotDrafts[entry.id] ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    className="max-h-28 w-full rounded-md object-contain"
                                    src={entryScreenshotDrafts[entry.id].previewUrl}
                                    alt="Pasted screenshot preview"
                                  />
                                ) : (
                                  entry.photoPath ? "Paste replacement" : "Paste screenshot"
                                )}
                              </div>
                            ) : null}
                            {entryScreenshotDrafts[entry.id] ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  className="h-8 rounded-md bg-[#245c4f] px-2 text-xs font-semibold text-white disabled:opacity-60"
                                  onClick={() => confirmEntryScreenshot(entry)}
                                  disabled={savingEntryScreenshotId === entry.id}
                                >
                                  {entry.photoPath ? "Update" : "Confirm"}
                                </button>
                                <button
                                  className="h-8 rounded-md border border-[#d8d2c5] px-2 text-xs font-semibold"
                                  onClick={() => removeEntryScreenshotDraft(entry.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            ) : editingScreenshotIds[entry.id] ? (
                              <button
                                className="mt-2 h-8 rounded-md border border-[#d8d2c5] px-2 text-xs font-semibold"
                                onClick={() => closeEntryScreenshotEditor(entry.id)}
                              >
                                Cancel
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3 xl:px-3">
                        <div className="flex flex-col gap-2">
                          {editingTimes[entry.id] ? (
                            <button
                              className="h-8 rounded-md bg-[#20231f] px-2 text-xs font-semibold text-white"
                              onClick={() => updateEntryTimes(entry)}
                            >
                              Save
                            </button>
                          ) : null}
                          {!entry.endTime && !isPendingEntry(entry) ? (
                            <button
                              className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-[#245c4f] px-2 text-xs font-semibold text-white"
                              onClick={() => stopTimer(entry.id)}
                              title="Stop timer"
                            >
                              <Square size={15} />
                              Stop
                            </button>
                          ) : null}
                          {isPendingEntry(entry) ? null : (
                            <button
                              className="inline-flex h-8 items-center justify-center rounded-md border border-[#d8d2c5]"
                              onClick={() => setDeleteTarget(entry)}
                              title="Delete entry"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleEntries.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-[#697066]" colSpan={9}>
                        No entries yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            className="w-full max-w-md rounded-md border border-[#ded9cd] bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-entry-title"
          >
            <h2 id="delete-entry-title" className="text-lg font-semibold text-[#20231f]">
              Delete entry?
            </h2>
            <p className="mt-2 text-sm text-[#4f554d]">
              This will permanently delete &quot;{deleteTarget.event}&quot; from {formatIrishDate(deleteTarget.startTime)}.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="h-10 rounded-md border border-[#d8d2c5] px-4 text-sm font-semibold hover:bg-[#f2eee5]"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className="h-10 rounded-md bg-[#9d2f2f] px-4 text-sm font-semibold text-white hover:bg-[#842727]"
                onClick={() => deleteEntry(deleteTarget.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
