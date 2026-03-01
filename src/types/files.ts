export interface DecryptedFile {
    id: string;
    owner_id: string;
    storage_path?: string;
    name: string;
    size: number;
    mimeType: string;
    created_at: string;
    expires_at: string | null;
    isShared?: boolean;
    ivBase64: string;
    wrappedKeyBase64: string;
}

export interface SharedFile {
    id: string;
    shareId: string;
    sharedBy: string;
    file_id: string;
    storage_path: string;
    name: string;
    size: number;
    mimeType: string;
    created_at: string;
    expires_at: string | null;
    ivBase64: string;
    wrappedKeyBase64: string;
    canDownload: boolean;
}
