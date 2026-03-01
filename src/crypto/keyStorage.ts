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
 */

const DB_NAME = 'e2e-keys'
const STORE_NAME = 'keypairs'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE_NAME)
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
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
        tx.oncomplete = () => db.close()
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
            db.close()
            resolve((req.result as CryptoKeyPair) ?? null)
        }
        req.onerror = () => {
            db.close()
            reject(req.error)
        }
    })
}
