/**
 * Тонкая промис-обёртка над IndexedDB.
 *
 * Схема повторяет таблицы прежнего PostgreSQL один в один, за вычетом таблицы
 * пользователей: приложение рассчитано на одного человека и работает локально.
 */

export const DB_NAME = 'phylo-viewer';
export const DB_VERSION = 1;

export const STORE_PROJECTS = 'projects';
export const STORE_DOCUMENTS = 'documents';
export const STORE_VIEW_STATES = 'viewStates';
export const STORE_TANGLEGRAM_STATES = 'tanglegramStates';

export const ALL_STORES = [
  STORE_PROJECTS,
  STORE_DOCUMENTS,
  STORE_VIEW_STATES,
  STORE_TANGLEGRAM_STATES,
] as const;

export type StoreName = (typeof ALL_STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
    db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
  }

  if (!db.objectStoreNames.contains(STORE_DOCUMENTS)) {
    const documents = db.createObjectStore(STORE_DOCUMENTS, { keyPath: 'id' });
    documents.createIndex('projectId', 'projectId', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_VIEW_STATES)) {
    db.createObjectStore(STORE_VIEW_STATES, { keyPath: 'treeDocumentId' });
  }

  if (!db.objectStoreNames.contains(STORE_TANGLEGRAM_STATES)) {
    db.createObjectStore(STORE_TANGLEGRAM_STATES, { keyPath: 'projectId' });
  }
}

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB недоступен в этом браузере'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => {
      const db = request.result;
      // Другая вкладка запросила обновление схемы: закрываемся, чтобы её не блокировать.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть локальную базу'));
    request.onblocked = () =>
      reject(new Error('Локальная база занята другой вкладкой. Закройте лишние вкладки и обновите страницу.'));
  });

  return dbPromise;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Ошибка запроса к локальной базе'));
  });
}

/**
 * Выполняет работу в одной транзакции и резолвится только после её фиксации,
 * чтобы вызывающий код никогда не читал незафиксированные данные.
 */
export async function runTransaction<T>(
  stores: StoreName | StoreName[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T> | T
): Promise<T> {
  const db = await openDatabase();
  const names = Array.isArray(stores) ? stores : [stores];

  return new Promise<T>((resolve, reject) => {
    let result: T;
    let settled = false;

    const tx = db.transaction(names, mode);
    tx.oncomplete = () => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    tx.onerror = () => {
      if (!settled) {
        settled = true;
        reject(tx.error ?? new Error('Транзакция локальной базы не выполнена'));
      }
    };
    tx.onabort = () => {
      if (!settled) {
        settled = true;
        reject(tx.error ?? new Error('Транзакция локальной базы отменена'));
      }
    };

    Promise.resolve()
      .then(() => work(tx))
      .then((value) => {
        result = value;
      })
      .catch((error: unknown) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
        try {
          tx.abort();
        } catch {
          // транзакция уже завершена
        }
      });
  });
}

export function storeGet<T>(tx: IDBTransaction, store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return promisifyRequest<T | undefined>(tx.objectStore(store).get(key) as IDBRequest<T | undefined>);
}

export function storeGetAll<T>(tx: IDBTransaction, store: StoreName): Promise<T[]> {
  return promisifyRequest<T[]>(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}

export function storeGetAllByIndex<T>(
  tx: IDBTransaction,
  store: StoreName,
  index: string,
  key: IDBValidKey
): Promise<T[]> {
  return promisifyRequest<T[]>(tx.objectStore(store).index(index).getAll(key) as IDBRequest<T[]>);
}

export function storePut<T>(tx: IDBTransaction, store: StoreName, value: T): Promise<IDBValidKey> {
  return promisifyRequest(tx.objectStore(store).put(value));
}

export function storeDelete(tx: IDBTransaction, store: StoreName, key: IDBValidKey): Promise<undefined> {
  return promisifyRequest(tx.objectStore(store).delete(key));
}

export function storeClear(tx: IDBTransaction, store: StoreName): Promise<undefined> {
  return promisifyRequest(tx.objectStore(store).clear());
}

/** Удаляет всю локальную базу. Используется при импорте резервной копии. */
export async function deleteDatabase(): Promise<void> {
  const db = await openDatabase().catch(() => null);
  db?.close();
  dbPromise = null;

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Не удалось удалить локальную базу'));
    request.onblocked = () => resolve();
  });
}
