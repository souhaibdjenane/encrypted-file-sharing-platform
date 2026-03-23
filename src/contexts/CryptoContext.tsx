/**
 * CryptoContext - makes the current user's CryptoKeyPair available
 * throughout the React tree via useCrypto().
 *
 * Usage:
 *   <CryptoProvider>          ← wrap in App.tsx
 *     <YourComponent />
 *   </CryptoProvider>
 *
 *   const { keyPair, keysReady } = useCrypto()
 */

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
} from 'react'
import { useAuthStore } from '@/store/authStore'
import { initializeUserKeys } from '@/crypto'

interface CryptoContextValue {
    /** The user's RSA-OAEP key pair, or null if not yet loaded. */
    keyPair: CryptoKeyPair | null
    /** True once the key pair has been successfully loaded or generated. */
    keysReady: boolean
    /** Error message if key initialisation failed. */
    keyError: string | null
}

const CryptoContext = createContext<CryptoContextValue | null>(null)

export function CryptoProvider({ children }: { children: ReactNode }) {
    const { user } = useAuthStore()
    const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null)
    const [keysReady, setKeysReady] = useState(false)
    const [keyError, setKeyError] = useState<string | null>(null)

    const initKeys = useCallback(async (userId: string) => {
        try {
            const kp = await initializeUserKeys(userId)
            setKeyPair(kp)
            setKeysReady(true)
            setKeyError(null)
        } catch (err) {
            console.error('[CryptoProvider] Key initialisation failed:', err)
            setKeyError(err instanceof Error ? err.message : 'Key init failed')
            setKeysReady(false)
        }
    }, [])

    useEffect(() => {
        if (user?.id) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            initKeys(user.id)
        } else {
            // User logged out — clear keys from memory
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setKeyPair(null)
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setKeysReady(false)
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setKeyError(null)
        }
    }, [user?.id, initKeys])

    return (
        <CryptoContext.Provider value={{ keyPair, keysReady, keyError }}>
            {children}
        </CryptoContext.Provider>
    )
}

/**
 * Hook to access the current user's CryptoKeyPair.
 * Must be used inside a <CryptoProvider>.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useCrypto(): CryptoContextValue {
    const ctx = useContext(CryptoContext)
    if (!ctx) {
        throw new Error('useCrypto must be used within a CryptoProvider')
    }
    return ctx
}
