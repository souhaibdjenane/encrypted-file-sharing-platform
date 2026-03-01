import React, { useState, useRef } from 'react';
import { useCrypto } from '../../contexts/CryptoContext';
import { encryptFile, encryptMetadata } from '../../crypto/encrypt';
import { wrapFileKey } from '../../crypto/keyWrap';
import { arrayBufferToBase64 } from '../../crypto/utils';
import { filesApi } from '../../api/filesApi';
import { useAuth } from '../../hooks/useAuth';

export const FileUploader: React.FC = () => {
    const { keyPair, keysReady } = useCrypto();
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setSuccess(false);
        }
    };

    const handleUpload = async () => {
        if (!file || !keyPair || !user || !keysReady) return;

        setIsUploading(true);
        setError(null);
        setSuccess(false);
        setProgress(10); // Start progress

        try {
            // 1. Client-side Encryption
            console.log('Encrypting file...');
            const { ciphertext, iv, fileKey } = await encryptFile(file);
            setProgress(30);

            // 2. Encrypt Metadata (Filename, etc., optionally)
            const metadata = { name: file.name, type: file.type, size: file.size };
            const encryptedMeta = await encryptMetadata(metadata, fileKey);
            setProgress(40);

            // 3. Get Presigned Upload URL from Edge Function
            console.log('Requesting upload URL...');
            const presignReq = {
                fileName: file.name,
                contentType: 'application/octet-stream', // We upload the encrypted blob
                fileSize: ciphertext.byteLength,
            };
            const { signedUrl, storagePath } = await filesApi.getUploadPresignUrl(presignReq);
            setProgress(50);

            // 4. Upload Encrypted Blob to Supabase Storage
            console.log('Uploading to Storage...');
            const blob = new Blob([ciphertext], { type: 'application/octet-stream' });
            const uploadRes = await fetch(signedUrl, {
                method: 'PUT',
                body: blob,
                headers: {
                    'Content-Type': 'application/octet-stream',
                },
            });

            if (!uploadRes.ok) {
                throw new Error(`Upload failed with status: ${uploadRes.status}`);
            }
            setProgress(80);

            // 5. Wrap the File Key for the Owner
            console.log('Wrapping key...');
            const wrappedKey = await wrapFileKey(fileKey, keyPair.publicKey);

            // Generate a random ID for the file record
            const fileId = crypto.randomUUID();

            // 6. Insert Database Records (File + Key)
            console.log('Saving metadata...');
            await filesApi.insertFileAndKey(
                {
                    id: fileId,
                    owner_id: user.id,
                    storage_path: storagePath,
                    encrypted_metadata: encryptedMeta,
                    file_size_bytes: file.size,
                    mime_type: file.type, // Store original mime locally? Or keep it in metadata? 
                    // Let's store 'application/octet-stream' in the DB column as it's encrypted, 
                    // but the real one is in encryptedMeta.
                    // Actually, schema might expect text. 
                    iv: arrayBufferToBase64(iv.buffer), // Browser compatible base64 
                },
                wrappedKey
            );

            setProgress(100);
            setSuccess(true);
            setFile(null); // Reset
            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (err) {
            const error = err as Error;
            console.error('Upload Error:', error);
            setError(error.message || 'An error occurred during upload.');
        } finally {
            setIsUploading(false);
            if (progress !== 100) setProgress(0);
        }
    };

    if (!user || !keysReady) {
        return <div className="p-4 text-center text-gray-500">Waiting for encryption keys...</div>;
    }

    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md space-y-4 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">Secure Uploader</h2>

            <div className="space-y-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    disabled={isUploading}
                    className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-indigo-50 file:text-indigo-700
                        hover:file:bg-indigo-100"
                />

                {file && (
                    <div className="text-xs text-gray-500">
                        Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                )}
            </div>

            {error && (
                <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                    {error}
                </div>
            )}

            {success && (
                <div className="p-3 text-sm text-green-700 bg-green-50 rounded-lg">
                    File securely encrypted and uploaded!
                </div>
            )}

            {isUploading && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden">
                    <div
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            )}

            <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className={`w-full py-2 px-4 rounded-lg font-medium text-white transition-colors
                    ${!file || isUploading
                        ? 'bg-indigo-300 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                    }`}
            >
                {isUploading ? `Encrypting & Uploading (${progress}%)...` : 'Encrypt & Upload'}
            </button>
            <p className="text-xs text-center text-gray-400 mt-2">
                🔒 End-to-end encrypted locally before leaving your device.
            </p>
        </div>
    );
};
