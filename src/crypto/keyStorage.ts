/**
 * IndexedDB key storage for CryptoKeyPair objects.
 *
 * DB name : "e2e-keys"
 * Store   : "keypairs"
 * Key     : userId (string)
 *
 * We use IndexedDB - not localStorage - because CryptoKeyPairs cannot
 * be serialised to JSON, and IndexedDB natively supports structured-clone
 * which handles CryptoKey objects correctly.
 *
 * Fix: The DB connection is cached as a module-level Promise singleton.
 * Previously each call opened and closed a fresh connection, which caused
 * "AbortError: Lock broken by another request with the 'steal' option"
 * when two concurrent open() calls raced (e.g. under React Strict Mode).
 */

const DB_NAME = 'e2e-keys'
const STORE_NAME = 'keypairs'
const DB_VERSION = 1

// Cached connection — all callers share one open IDBDatabase instance.
let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise

    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)

        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE_NAME)
        }

        req.onsuccess = () => resolve(req.result)

        req.onerror = () => {
            // Clear the cache so a future call can retry
            dbPromise = null
            reject(req.error)
        }
    })

    return dbPromise
}

/**
 * Persists a CryptoKeyPair in IndexedDB, keyed by userId.
 * Overwrites any existing entry for that user.
 */
export async function storeKeyPair(
    userId: string,
    keyPair: CryptoKeyPair,
): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const req = store.put(keyPair, userId)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
        // Do NOT close the db here — closing mid-transaction aborts it and
        // causes a lock-steal error for any concurrent open() request.
        tx.onerror = () => reject(tx.error)
    })
}

/**
 * Loads a CryptoKeyPair from IndexedDB for the given userId.
 * Returns null if no key pair exists yet.
 */
export async function loadKeyPair(
    userId: string,
): Promise<CryptoKeyPair | null> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.get(userId)
        req.onsuccess = () => {
            resolve((req.result as CryptoKeyPair) ?? null)
        }
        req.onerror = () => {
            reject(req.error)
        }
        tx.onerror = () => reject(tx.error)
    })
}
