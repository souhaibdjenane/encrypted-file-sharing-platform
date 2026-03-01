/**
 * Public barrel + initializeUserKeys orchestration.
 *
 * Call initializeUserKeys(userId) right after authentication.
 * It will:
 *   1. Try to load an existing key pair from IndexedDB.
 *   2. If none exists, generate a fresh RSA-OAEP 4096-bit key pair.
 *   3. Store the key pair in IndexedDB.
 *   4. Upload the base64 SPKI public key to Supabase user_metadata.
 */

import { supabase } from '@/lib/supabase'
import { generateKeyPair, exportPublicKey } from './keys'
import { storeKeyPair, loadKeyPair } from './keyStorage'

export * from './utils'
export * from './keys'
export * from './encrypt'
export * from './decrypt'
export * from './keyWrap'
export * from './keyStorage'

export async function initializeUserKeys(userId: string): Promise<CryptoKeyPair> {
    // 1. Try to load existing key pair
    const existing = await loadKeyPair(userId)
    if (existing) return existing

    // 2. Generate new key pair
    const keyPair = await generateKeyPair()

    // 3. Store in IndexedDB
    await storeKeyPair(userId, keyPair)

    // 4. Export public key and upload to Supabase user_metadata
    const publicKeyBase64 = await exportPublicKey(keyPair.publicKey)
    await supabase.auth.updateUser({
        data: { public_key: publicKeyBase64 },
    })

    return keyPair
}
