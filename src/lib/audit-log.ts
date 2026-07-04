import { openDB, type IDBPDatabase } from 'idb';

export interface AuditEntry {
  id?: number;
  timestamp: number;
  studentId: string;
  studentName: string;
  studentAvatarUrl?: string;
  eventType: 'unfocused' | 'focus_returned' | 'periodic_snapshot' | 'offline';
  screenshot?: string;
  read: boolean;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function initAuditDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB('cctv-audit', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('entries')) {
          const store = db.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('unread', 'read');
        }
      },
    });
  }
  return dbPromise;
}

export async function addEntry(entry: Omit<AuditEntry, 'id'>): Promise<number> {
  const db = await initAuditDB();
  return db.add('entries', entry) as Promise<number>;
}

export async function getEntries(): Promise<AuditEntry[]> {
  const db = await initAuditDB();
  const entries = await db.getAll('entries');
  return entries.reverse();
}

export async function getUnreadCount(): Promise<number> {
  const db = await initAuditDB();
  const all = await db.getAll('entries');
  return all.filter((e) => !e.read).length;
}

export async function markAsRead(id: number): Promise<void> {
  const db = await initAuditDB();
  const entry = await db.get('entries', id);
  if (entry) {
    entry.read = true;
    await db.put('entries', entry);
  }
}

export async function markAllAsRead(): Promise<void> {
  const db = await initAuditDB();
  const tx = db.transaction('entries', 'readwrite');
  const store = tx.objectStore('entries');
  let cursor = await store.openCursor();
  while (cursor) {
    cursor.value.read = true;
    await cursor.update(cursor.value);
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await initAuditDB();
  await db.delete('entries', id);
}

export async function deleteStudentEntries(studentId: string): Promise<void> {
  const db = await initAuditDB();
  const tx = db.transaction('entries', 'readwrite');
  const store = tx.objectStore('entries');
  let cursor = await store.openCursor();
  while (cursor) {
    if (cursor.value.studentId === studentId) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function clearAll(): Promise<void> {
  const db = await initAuditDB();
  await db.clear('entries');
}
