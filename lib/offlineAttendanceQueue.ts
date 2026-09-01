"use client";

// Dependency-free IndexedDB queue for attendance writes made while
// offline. Deliberately scoped to attendance only, not a generic
// offline-everything layer — attendance marking is the one write that
// genuinely needs to survive a dead connection (a teacher standing in a
// classroom with patchy wifi), per the P6 scope. Other forms in the app
// already show a clear error and let the person retry once back online,
// which is a reasonable default everywhere else.

import type { AttendanceStatus } from "@/types/database";

const DB_NAME = "school-app-offline";
const DB_VERSION = 1;
const STORE_NAME = "queued_attendance";

export type QueuedAttendance = {
  id: string; // crypto.randomUUID() — local key, unrelated to any server id
  classId: string;
  date: string;
  classLabel: string; // class name + date, for display in the sync indicator
  records: { studentId: string; status: AttendanceStatus }[];
  queuedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueAttendance(
  entry: Omit<QueuedAttendance, "id" | "queuedAt">
): Promise<void> {
  const db = await openDb();
  const record: QueuedAttendance = {
    ...entry,
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedAttendance(): Promise<QueuedAttendance[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as QueuedAttendance[]);
    request.onerror = () => reject(request.error);
  });
}

export async function removeQueuedAttendance(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * A network failure specifically (fetch couldn't even reach the server)
 * as opposed to a server-side rejection (validation error, RLS denial,
 * "you aren't the teacher for this lesson", etc.) — only the former
 * should be queued for retry. Queueing a genuine permission error would
 * just mean it fails again, silently, later.
 */
export function looksLikeNetworkFailure(err: unknown): boolean {
  if (!navigator.onLine) return true;
  // Browsers throw a bare TypeError for a fetch that never got a
  // response (DNS failure, connection refused, offline mid-request).
  // A server action rejection instead resolves with a thrown Error
  // carrying the server's message, not a TypeError.
  return err instanceof TypeError;
}
