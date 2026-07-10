"use client";

import { ClipboardEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Download, ExternalLink, Play, Square, Trash2 } from "lucide-react";
import {
  entryDuration,
  formatDuration,
  formatIrishDate,
  formatIrishTime,
  fromIrishDateTimeInput,
  IRISH_TIME_ZONE,
  toIrishDateTimeInput,
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

export default function Home() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [draftEntry, setDraftEntry] = useState<DraftEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingTimes, setEditingTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});

  const fetchEntries = useCallback(async () => {
    try {
      const response = await fetch("/api/entries");
      const data = await readJsonResponse<TimeEntry[]>(response);

      if (!response.ok || !Array.isArray(data)) {
        setMessage(data.message ?? "Could not load entries.");
        return;
      }

      setEntries(data);
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

  async function uploadScreenshotFile(file: File) {
    if (!file) return;

    const data = new FormData();
    data.append("photo", file);
    try {
      const response = await fetch("/api/upload", { method: "POST", body: data });
      const result = await readJsonResponse<{ path?: string }>(response);

      if (!response.ok) {
        setMessage(`${result.message ?? "Photo upload failed."} The timer is still safe; you can add the screenshot later.`);
        return;
      }

      setForm((current) => ({ ...current, photoPath: result.path ?? "" }));
      setMessage("Screenshot pasted.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Photo upload failed.";
      setMessage(`${errorMessage} The timer is still safe; you can add the screenshot later.`);
    }
  }

  async function pasteScreenshot(event: ClipboardEvent<HTMLDivElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));
    const file = imageItem?.getAsFile();

    if (!file) {
      setMessage("No screenshot image found on the clipboard.");
      return;
    }

    event.preventDefault();
    await uploadScreenshotFile(file);
  }

  async function startTimer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.event.trim()) {
      setMessage("Add a task before starting the timer.");
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

    const startTime = fromIrishDateTimeInput(values.startTime);
    const endTime = values.endTime ? fromIrishDateTimeInput(values.endTime) : null;

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

  async function deleteEntry(id: string) {
    const response = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    const result = await readJsonResponse<{ ok?: boolean }>(response);

    if (!response.ok) {
      setMessage(result.message ?? "Could not delete entry.");
      return;
    }

    setEntries((current) => current.filter((entry) => entry.id !== id));
    if (activeId === id) setActiveId(null);
  }

  const visibleEntries = draftEntry ? [draftEntry, ...entries] : entries;

  const totalToday = visibleEntries
    .filter((entry) => formatIrishDate(entry.startTime) === formatIrishDate(new Date()))
    .reduce((sum, entry) => sum + entryDuration(entry.startTime, entry.endTime), 0);

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#20231f]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
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

        <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
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
            <input
              className="mt-2 h-11 w-full rounded-md border border-[#cfc8ba] px-3 outline-none focus:border-[#245c4f]"
              value={form.event}
              onChange={(event) => setForm({ ...form, event: event.target.value })}
              placeholder="Client call, research, writing..."
            />

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
              className="mt-2 flex min-h-24 cursor-text items-center justify-center rounded-md border border-dashed border-[#b9b09f] bg-[#fbfaf7] px-3 py-4 text-center text-sm text-[#697066] outline-none focus:border-[#245c4f]"
              onPaste={pasteScreenshot}
              tabIndex={0}
              role="textbox"
              aria-label="Paste screenshot"
            >
              Paste a recent screenshot here
            </div>
            <div className="mt-2 flex items-center gap-3">
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

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="bg-[#f2eee5] text-xs uppercase text-[#5f655d]">
                  <tr>
                    {["Date", "Start Time", "End Time", "Event", "Description", "Duration", "Link", "Screenshot", ""].map((column) => (
                      <th key={column} className="px-4 py-3 font-semibold">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map((entry) => (
                    <tr key={entry.id} className="border-t border-[#ece7dc] align-top">
                      <td className="px-4 py-3">{formatIrishDate(entry.startTime)}</td>
                      <td className="px-4 py-3">
                        <input
                          className="h-9 w-44 rounded-md border border-[#d8d2c5] px-2 font-mono text-xs"
                          type="datetime-local"
                          value={editingTimes[entry.id]?.startTime ?? toIrishDateTimeInput(entry.startTime)}
                          disabled={isPendingEntry(entry)}
                          onChange={(event) =>
                            setEditingTimes((current) => ({
                              ...current,
                              [entry.id]: {
                                startTime: event.target.value,
                                endTime: current[entry.id]?.endTime ?? toIrishDateTimeInput(entry.endTime),
                              },
                            }))
                          }
                        />
                        <p className="mt-1 font-mono text-xs text-[#697066]">{formatIrishTime(entry.startTime)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="h-9 w-44 rounded-md border border-[#d8d2c5] px-2 font-mono text-xs"
                          type="datetime-local"
                          value={editingTimes[entry.id]?.endTime ?? toIrishDateTimeInput(entry.endTime)}
                          disabled={isPendingEntry(entry)}
                          onChange={(event) =>
                            setEditingTimes((current) => ({
                              ...current,
                              [entry.id]: {
                                startTime: current[entry.id]?.startTime ?? toIrishDateTimeInput(entry.startTime),
                                endTime: event.target.value,
                              },
                            }))
                          }
                        />
                        <p className="mt-1 font-mono text-xs text-[#697066]">
                          {entry.endTime ? formatIrishTime(entry.endTime) : "Running"}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {entry.event}
                        {isPendingEntry(entry) ? (
                          <span className="ml-2 rounded-md bg-[#fff3d6] px-2 py-1 text-xs text-[#75540f]">Saving</span>
                        ) : null}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-[#4f554d]">{entry.description}</td>
                      <td className="px-4 py-3 font-mono">{formatDuration(entryDuration(entry.startTime, entry.endTime))}</td>
                      <td className="px-4 py-3">
                        {entry.link ? (
                          <a className="inline-flex items-center gap-1 text-[#245c4f]" href={entry.link} target="_blank">
                            Open <ExternalLink size={14} />
                          </a>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {entry.photoPath ? (
                          <a className="inline-flex items-center gap-1 text-[#245c4f]" href={entry.photoPath} target="_blank">
                            Screenshot <Camera size={14} />
                          </a>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {editingTimes[entry.id] ? (
                            <button
                              className="h-8 rounded-md bg-[#20231f] px-3 text-xs font-semibold text-white"
                              onClick={() => updateEntryTimes(entry)}
                            >
                              Save
                            </button>
                          ) : null}
                          {!entry.endTime && !isPendingEntry(entry) ? (
                            <button
                              className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-[#245c4f] px-3 text-xs font-semibold text-white"
                              onClick={() => stopTimer(entry.id)}
                              title="Stop timer"
                            >
                              <Square size={15} />
                              Stop
                            </button>
                          ) : null}
                          {isPendingEntry(entry) ? null : (
                            <button
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#d8d2c5]"
                              onClick={() => deleteEntry(entry.id)}
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
    </main>
  );
}
