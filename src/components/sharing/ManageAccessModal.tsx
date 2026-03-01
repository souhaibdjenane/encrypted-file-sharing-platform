import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../api/supabaseClient';
import { filesApi } from '../../api/filesApi';

export interface ManageAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileId: string;
    fileName: string;
}

interface ShareRecord {
    id: string;
    shared_with: string | null;
    created_at: string;
    revoked: boolean;
}

export const ManageAccessModal: React.FC<ManageAccessModalProps> = ({
    isOpen,
    onClose,
    fileId,
    fileName,
}) => {
    const [shares, setShares] = useState<ShareRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadShares = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('shares')
                .select('id, shared_with, created_at, revoked')
                .eq('file_id', fileId)
                .order('created_at', { ascending: false });

            if (fetchError) throw new Error(fetchError.message);
            setShares(data || []);
        } catch (err: any) {
            console.error('Error fetching shares:', err);
            setError(err.message || 'Failed to load access list.');
        } finally {
            setIsLoading(false);
        }
    }, [fileId]);

    useEffect(() => {
        if (isOpen) {
            loadShares();
        }
    }, [isOpen, loadShares]);

    const handleRevoke = async (shareId: string) => {
        try {
            setRevokingId(shareId);
            await filesApi.revokeAccess({ shareId });
            // Update local state to show as revoked
            setShares(shares.map(s => s.id === shareId ? { ...s, revoked: true } : s));
        } catch (err: any) {
            console.error('Revoke error:', err);
            alert(`Revocation failed: ${err.message}`);
        } finally {
            setRevokingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-vs-bg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-vs-border/50 flex justify-between items-center bg-vs-bg-subtle/50">
                    <h3 className="font-semibold text-lg text-vs-text">Manage Access</h3>
                    <button
                        onClick={onClose}
                        className="text-vs-text-muted hover:text-vs-text transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6">
                    <div className="mb-6">
                        <p className="text-sm font-medium text-vs-text mb-1 truncate">
                            {fileName}
                        </p>
                        <p className="text-xs text-vs-text-subtle">
                            View and revoke access permissions for this file.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 text-sm text-vs-danger bg-red-50/50 rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {isLoading ? (
                            <p className="text-sm text-vs-text-subtle text-center py-4">Loading access records...</p>
                        ) : shares.length === 0 ? (
                            <p className="text-sm text-vs-text-subtle text-center py-4 bg-vs-bg-subtle rounded-lg">
                                This file hasn't been shared securely yet.
                            </p>
                        ) : (
                            shares.map((share) => (
                                <div key={share.id} className="flex items-center justify-between p-3 rounded-lg border border-vs-border bg-vs-bg-subtle/50">
                                    <div>
                                        <p className="text-sm font-medium text-vs-text truncate max-w-[200px]" title={share.shared_with || 'Unknown User'}>
                                            User ID: {share.shared_with ? share.shared_with.substring(0, 8) + '...' : 'Unknown'}
                                        </p>
                                        <p className="text-xs text-vs-text-subtle">
                                            Shared on {new Date(share.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        {share.revoked ? (
                                            <span className="text-xs font-semibold text-vs-danger bg-red-50 px-2 py-1 rounded">
                                                Revoked
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleRevoke(share.id)}
                                                disabled={revokingId === share.id}
                                                className="text-xs font-medium text-vs-danger hover:text-white hover:bg-vs-danger border border-vs-danger/30 hover:border-transparent px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                                            >
                                                {revokingId === share.id ? 'Revoking...' : 'Revoke'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="pt-6 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-vs-text bg-vs-bg-subtle hover:bg-vs-border/50 rounded-lg transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
