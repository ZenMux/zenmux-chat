import type {
  NetworkService,
  BlobUploadMetadata,
  NetworkWindowRecord,
  NetworkSessionSnapshot,
  SessionMeta,
  SessionIndexEntry,
  SessionSnapshot,
} from './types';

// ─── IndexedDB 常量 ──────────────────────────────────────────────

const IDB_NAME = 'chat-network';
const IDB_VERSION = 1;
const IDB_BLOB_STORE = 'blobs';

/** blob "URL" 使用自定义协议前缀，方便识别 */
const BLOB_URL_PREFIX = 'local-blob://';

// ─── localStorage key 约定 ──────────────────────────────────────

const LS_PREFIX = 'chat-network:';
const LS_META_KEY = `${LS_PREFIX}meta`;
const LS_SESSION_INDEX_KEY = `${LS_PREFIX}session-index`;
const lsRecordKey = (windowId: string) => `${LS_PREFIX}record:${windowId}`;
const lsSessionKey = (sessionId: string) => `${LS_PREFIX}session:${sessionId}`;

/** localStorage 中的元数据（扩展 SessionMeta，额外记录 windowIds 列表） */
interface LocalMeta extends SessionMeta {
  windowIds: string[];
}

// ─── IndexedDB 辅助 ─────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_BLOB_STORE)) {
        db.createObjectStore(IDB_BLOB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_BLOB_STORE, 'readwrite');
    tx.objectStore(IDB_BLOB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<Blob | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_BLOB_STORE, 'readonly');
    const req = tx.objectStore(IDB_BLOB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_BLOB_STORE, 'readwrite');
    tx.objectStore(IDB_BLOB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── 工厂函数 ────────────────────────────────────────────────────

/**
 * 创建基于 localStorage + IndexedDB 的本地 NetworkService 实现。
 * - IndexedDB: 存储 blob 数据（图片、thoughtSignature 等大二进制）
 * - localStorage: 存储窗口记录和会话元数据（JSON，已无二进制）
 */
export function createLocalNetworkService(): NetworkService {
  let dbPromise: Promise<IDBDatabase> | null = null;

  function getDB(): Promise<IDBDatabase> {
    if (!dbPromise) {
      dbPromise = openDB();
    }
    return dbPromise;
  }

  // ─── localStorage 辅助 ──────────────────────────────────────

  function readMeta(): LocalMeta {
    try {
      const raw = localStorage.getItem(LS_META_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* 损坏则返回默认值 */ }
    return { windowIds: [], activeWindowId: null, pkLayout: null };
  }

  function writeMeta(meta: LocalMeta): void {
    localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
  }

  // ─── NetworkService 实现 ────────────────────────────────────

  return {
    async uploadBlob(blob: Blob, _metadata: BlobUploadMetadata): Promise<string> {
      const id = crypto.randomUUID();
      const key = `${BLOB_URL_PREFIX}${id}`;
      const db = await getDB();
      await idbPut(db, key, blob);
      return key;
    },

    async downloadBlob(url: string): Promise<Blob> {
      const db = await getDB();
      const blob = await idbGet(db, url);
      if (!blob) {
        throw new Error(`[LocalNetworkService] Blob not found: ${url}`);
      }
      return blob;
    },

    async saveWindowRecord(windowId: string, record: NetworkWindowRecord): Promise<void> {
      // 1. 保存窗口记录到 localStorage
      localStorage.setItem(lsRecordKey(windowId), JSON.stringify(record));

      // 2. 更新元数据中的窗口列表
      const meta = readMeta();
      if (!meta.windowIds.includes(windowId)) {
        meta.windowIds.push(windowId);
      }
      writeMeta(meta);
    },

    async loadAllRecords(): Promise<NetworkSessionSnapshot> {
      const meta = readMeta();

      const windows: NetworkWindowRecord[] = [];
      for (const windowId of meta.windowIds) {
        try {
          const raw = localStorage.getItem(lsRecordKey(windowId));
          if (raw) {
            windows.push(JSON.parse(raw));
          }
        } catch {
          console.warn(`[LocalNetworkService] 解析窗口记录 ${windowId} 失败，跳过`);
        }
      }

      return {
        windows,
        pkLayout: meta.pkLayout,
        activeWindowId: meta.activeWindowId,
      };
    },

    async saveSessionMeta(sessionMeta: SessionMeta): Promise<void> {
      const meta = readMeta();
      meta.activeWindowId = sessionMeta.activeWindowId;
      meta.pkLayout = sessionMeta.pkLayout;
      writeMeta(meta);
    },

    async deleteWindowRecord(windowId: string): Promise<void> {
      // 1. 收集该窗口所有 blob URL 以便清理 IndexedDB
      const blobUrls: string[] = [];
      try {
        const raw = localStorage.getItem(lsRecordKey(windowId));
        if (raw) {
          const record: NetworkWindowRecord = JSON.parse(raw);
          for (const msg of record.messages) {
            if (msg.attachments) {
              for (const att of msg.attachments) blobUrls.push(att.url);
            }
            if (msg.generatedFiles) {
              for (const file of msg.generatedFiles) blobUrls.push(file.url);
            }
            if (msg.responseContentBlobRefs) {
              for (const ref of msg.responseContentBlobRefs) blobUrls.push(ref.url);
            }
          }
        }
      } catch { /* 解析失败不阻塞删除 */ }

      // 2. 删除 localStorage 中的窗口记录
      localStorage.removeItem(lsRecordKey(windowId));

      // 3. 更新元数据
      const meta = readMeta();
      meta.windowIds = meta.windowIds.filter((id) => id !== windowId);
      writeMeta(meta);

      // 4. 异步清理 IndexedDB 中的 blob（不阻塞）
      if (blobUrls.length > 0) {
        getDB().then(async (db) => {
          for (const url of blobUrls) {
            await idbDelete(db, url).catch(() => {});
          }
        }).catch(() => {});
      }
    },

    // ─── 会话级持久化 ─────────────────────────────────────────

    async saveSessionIndex(sessions: SessionIndexEntry[]): Promise<void> {
      localStorage.setItem(LS_SESSION_INDEX_KEY, JSON.stringify(sessions));
    },

    async loadSessionIndex(): Promise<SessionIndexEntry[]> {
      try {
        const raw = localStorage.getItem(LS_SESSION_INDEX_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },

    async saveSession(sessionId: string, snapshot: SessionSnapshot): Promise<void> {
      localStorage.setItem(lsSessionKey(sessionId), JSON.stringify(snapshot));
    },

    async loadSession(sessionId: string): Promise<SessionSnapshot | null> {
      try {
        const raw = localStorage.getItem(lsSessionKey(sessionId));
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    async deleteSession(sessionId: string): Promise<void> {
      // 1. 收集快照中所有 blob URL
      const blobUrls: string[] = [];
      try {
        const raw = localStorage.getItem(lsSessionKey(sessionId));
        if (raw) {
          const snapshot: SessionSnapshot = JSON.parse(raw);
          for (const record of snapshot.windows) {
            collectBlobUrls(record, blobUrls);
          }
        }
      } catch { /* 解析失败不阻塞删除 */ }

      // 2. 删除会话快照
      localStorage.removeItem(lsSessionKey(sessionId));

      // 3. 异步清理 blob
      if (blobUrls.length > 0) {
        getDB().then(async (db) => {
          for (const url of blobUrls) {
            await idbDelete(db, url).catch(() => {});
          }
        }).catch(() => {});
      }
    },
  };
}

/** 从窗口记录中收集所有 blob URL */
function collectBlobUrls(record: NetworkWindowRecord, out: string[]): void {
  for (const msg of record.messages) {
    if (msg.attachments) {
      for (const att of msg.attachments) out.push(att.url);
    }
    if (msg.generatedFiles) {
      for (const file of msg.generatedFiles) out.push(file.url);
    }
    if (msg.responseContentBlobRefs) {
      for (const ref of msg.responseContentBlobRefs) out.push(ref.url);
    }
  }
}
