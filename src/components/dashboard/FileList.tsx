import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useCrypto } from '../../contexts/CryptoContext';
import { unwrapFileKey } from '../../crypto/keyWrap';
import { decryptMetadata, decryptFile } from '../../crypto/decrypt';
import { base64ToArrayBuffer } from '../../crypto/utils';
import { filesApi } from '../../api/filesApi';
import DocumentIcon from '../../assets/Document.svg';
import { ShareModal } from '../sharing/ShareModal';
import { ManageAccessModal } from '../sharing/ManageAccessModal';

import type { DecryptedFile } from '../../types/files';

export function FileList() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { keyPair, keysReady } = useCrypto();
    const [files, setFiles] = useState<DecryptedFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
    const [selectedShareFile, setSelectedShareFile] = useState<DecryptedFile | null>(null);
    const [selectedManageFile, setSelectedManageFile] = useState<DecryptedFile | null>(null);

    const loadFiles = useCallback(async () => {
        if (!user || !keyPair || !keysReady) return;

        setIsLoading(true);
        setError(null);

        try {
            // Fetch files I own OR files shared with me
            // For now, let's fetch files I own where I have a file_keys record
            const { data, error: fetchError } = await supabase
                .from('files')
                .select(`
                    id,
                    owner_id,
                    created_at,
                    expires_at,
                    iv,
                    encrypted_metadata,
                    file_keys!inner(wrapped_key)
                `)
                .eq('owner_id', user.id) // Only my files for now
                .order('created_at', { ascending: false });

            if (fetchError) throw new Error(fetchError.message);

            if (!data) {
                setFiles([]);
                return;
            }

            const decryptedList: DecryptedFile[] = [];

            // Decrypt metadata for each file
            for (const fileRow of data) {
                try {
                    // Extract wrapped key (assuming one record per user due to unique constraint)
                    const wrappedKeyBase64 = Array.isArray(fileRow.file_keys)
                        ? fileRow.file_keys[0].wrapped_key
                        : (fileRow.file_keys as { wrapped_key: string }).wrapped_key;

                    // Unwrap the AES key
                    const fileKey = await unwrapFileKey(wrappedKeyBase64, keyPair.privateKey);

                    // Decrypt the metadata JSON
                    const metaObj = fileRow.encrypted_metadata as { ciphertext: string; iv: string };
                    const decryptedMeta = await decryptMetadata(metaObj.ciphertext, metaObj.iv, fileKey) as { name?: string; size?: number; type?: string };

                    decryptedList.push({
                        id: fileRow.id,
                        owner_id: fileRow.owner_id,
                        name: decryptedMeta.name || 'Unknown File',
                        size: decryptedMeta.size || 0,
                        mimeType: decryptedMeta.type || 'application/octet-stream',
                        created_at: fileRow.created_at,
                        expires_at: fileRow.expires_at || null,
                        isShared: false,
                        ivBase64: fileRow.iv,
                        wrappedKeyBase64: wrappedKeyBase64,
                    });
                } catch (decryptErr) {
                    console.error(`Failed to decrypt metadata for file ${fileRow.id}:`, decryptErr);
                    // Still show it, but mark as undecryptable
                    decryptedList.push({
                        id: fileRow.id,
                        owner_id: fileRow.owner_id,
                        name: '🔒 Encrypted (Decryption Failed)',
                        size: 0,
                        mimeType: 'unknown',
                        created_at: fileRow.created_at,
                        expires_at: fileRow.expires_at || null,
                        isShared: false,
                        ivBase64: fileRow.iv,
                        wrappedKeyBase64: Array.isArray(fileRow.file_keys)
                            ? fileRow.file_keys[0].wrapped_key
                            : (fileRow.file_keys as { wrapped_key: string }).wrapped_key,
                    });
                }
            }

            setFiles(decryptedList);

        } catch (err) {
            const error = err as Error;
            console.error('Error loading files:', error);
            let errorMessage = error.message || 'Failed to load files';
            try {
                const parsed = JSON.parse(error.message);
                if (parsed && parsed.error && Array.isArray(parsed.error.errors)) {
                    errorMessage = parsed.error.errors.map((e: { message: string }) => e.message).join('; ');
                }
            } catch {
                // Not a JSON error, use original message
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [user, keyPair, keysReady]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    const handleDownload = async (file: DecryptedFile) => {
        if (!keyPair) return;

        try {
            setDownloadingFileId(file.id);

            // 1. Get Presigned Download URL
            const { signedUrl } = await filesApi.getDownloadPresignUrl({ fileId: file.id });

            // 2. Fetch Ciphertext Blob
            const response = await fetch(signedUrl);
            if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
            const encryptedBuffer = await response.arrayBuffer();

            // 3. Unwrap File Key
            const fileKey = await unwrapFileKey(file.wrappedKeyBase64, keyPair.privateKey);

            // 4. Decrypt File
            const ivBuffer = new Uint8Array(base64ToArrayBuffer(file.ivBase64));
            const decryptedBuffer = await decryptFile(encryptedBuffer, ivBuffer, fileKey);

            // 5. Trigger Browser Download
            const blob = new Blob([decryptedBuffer], { type: file.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (err) {
            const error = err as Error;
            console.error('Download failed:', error);
            alert(`Download failed: ${error.message}`);
        } finally {
            setDownloadingFileId(null);
        }
    };

    if (!keysReady) {
        return <div className="text-center p-4 text-vs-text-subtle">Waiting for encryption keys...</div>;
    }

    if (isLoading) {
        return <div className="text-center p-8 text-vs-text-subtle">Decrypting and loading your Vault...</div>;
    }

    if (error) {
        return <div className="text-center p-8 text-vs-danger bg-red-50 rounded-xl">{error}</div>;
    }

    if (files.length === 0) {
        return (
            <div className="rounded-xl border border-vs-border bg-vs-bg p-8 text-center text-vs-text-subtle text-sm">
                {t('dashboard.noFiles')}
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-vs-border text-vs-text-subtle text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Size</th>
                        <th className="px-4 py-3 font-medium">Uploaded</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-vs-border">
                    {files.map((f) => (
                        <tr key={f.id} className="hover:bg-vs-bg-subtle transition-colors group">
                            <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                        <img src={DocumentIcon} alt="Doc" className="w-5 h-5 opacity-70" />
                                    </div>
                                    <div className="max-w-[200px] sm:max-w-xs truncate font-medium text-vs-text">
                                        {f.name}
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-vs-text-subtle">
                                {(f.size / 1024 / 1024).toFixed(2)} MB
                            </td>
                            <td className="px-4 py-4 text-sm text-vs-text-subtle">
                                {new Date(f.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-4 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleDownload(f)}
                                    disabled={downloadingFileId === f.id}
                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-opacity"
                                >
                                    {downloadingFileId === f.id ? 'Decrypting...' : 'Download'}
                                </button>
                                <button
                                    onClick={() => setSelectedShareFile(f)}
                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                                >
                                    Share
                                </button>
                                <button
                                    onClick={() => setSelectedManageFile(f)}
                                    className="text-sm font-medium text-gray-500 hover:text-gray-700"
                                >
                                    Manage
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {selectedShareFile && (
                <ShareModal
                    isOpen={!!selectedShareFile}
                    onClose={() => setSelectedShareFile(null)}
                    fileId={selectedShareFile.id}
                    fileName={selectedShareFile.name}
                    wrappedKeyBase64={selectedShareFile.wrappedKeyBase64}
                />
            )}

            {selectedManageFile && (
                <ManageAccessModal
                    isOpen={!!selectedManageFile}
                    onClose={() => setSelectedManageFile(null)}
                    fileId={selectedManageFile.id}
                    fileName={selectedManageFile.name}
                />
            )}
        </div>
    );
};

interface ShareModalProps {
    isOpen: boolean
    onClose: () => void
    fileId: string
    fileName: string
    wrappedKeyBase64: string
}

interface ManageAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileId: string;
    fileName: string;
}
```
