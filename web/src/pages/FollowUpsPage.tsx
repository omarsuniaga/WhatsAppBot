/**
 * FollowUpsPage - Fase D of docs/SPEC_CONVERSACION_GUIADA.md
 * Queue of re-engagement suggestions for chats gone cold. A human always
 * approves (optionally editing the text) or discards — nothing is sent
 * automatically (spec section 7 and 10).
 */
import { useState, useEffect } from 'react';
import { UserRoundSearch, Loader2, Send, Trash2, RefreshCw } from 'lucide-react';
import { followUpApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

type FollowUpReason = 'flow_abandoned' | 'inactive_lead';
type FollowUpStatus = 'pending' | 'sent' | 'discarded';

interface FollowUpSuggestion {
    id: string;
    chatJid: string;
    contactName: string;
    relationType: string;
    reason: FollowUpReason;
    sourceFlowId?: string;
    suggestedMessage: string;
    status: FollowUpStatus;
    createdAt: string;
    sentMessage?: string;
}

const reasonLabels: Record<FollowUpReason, string> = {
    flow_abandoned: 'Flujo guiado sin respuesta',
    inactive_lead: 'Contacto sin actividad'
};

export const FollowUpsPage = () => {
    const { currentUser } = useAuth();
    const [suggestions, setSuggestions] = useState<FollowUpSuggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingText, setEditingText] = useState<Record<string, string>>({});
    const [showAll, setShowAll] = useState(false);
    const [isSweeping, setIsSweeping] = useState(false);

    useEffect(() => {
        loadSuggestions();
    }, [showAll]);

    const loadSuggestions = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await followUpApi.getAll(showAll ? 'all' : 'pending');
            if (response.data.success) setSuggestions(response.data.data || []);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (s: FollowUpSuggestion) => {
        const text = editingText[s.id] ?? s.suggestedMessage;
        if (!confirm(`¿Enviar este mensaje a ${s.contactName}?\n\n"${text}"`)) return;
        try {
            await followUpApi.approve(s.id, text, currentUser?.email || 'admin');
            await loadSuggestions();
        } catch (err: any) {
            alert('Error: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDiscard = async (id: string) => {
        const reason = prompt('¿Motivo para descartar? (opcional)') || undefined;
        try {
            await followUpApi.discard(id, reason, currentUser?.email || 'admin');
            await loadSuggestions();
        } catch (err: any) {
            alert('Error: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleSweep = async () => {
        setIsSweeping(true);
        try {
            await followUpApi.runSweep();
            await loadSuggestions();
        } catch (err: any) {
            alert('Error: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsSweeping(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <UserRoundSearch className="w-6 h-6 text-[#00a884]" />
                    <div>
                        <h1 className="text-xl font-semibold text-gray-800 dark:text-[#e9edef]">Retomar Conversaciones</h1>
                        <p className="text-sm text-gray-500 dark:text-[#8696a0]">
                            Sugerencias de seguimiento para chats fríos — nada se envía sin tu aprobación (Fase D)
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#202c33] text-gray-600 dark:text-[#aebac1]"
                    >
                        {showAll ? 'Solo pendientes' : 'Ver todas'}
                    </button>
                    <button
                        onClick={handleSweep}
                        disabled={isSweeping}
                        title="Ejecutar barrido de silencio ahora (normalmente corre cada hora)"
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#00a884] text-white rounded-full text-xs font-medium hover:bg-[#06cf9c] disabled:opacity-50"
                    >
                        {isSweeping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Revisar ahora
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 text-[#00a884] animate-spin" />
                </div>
            ) : error ? (
                <p className="text-red-500 text-sm">{error}</p>
            ) : suggestions.length === 0 ? (
                <p className="text-gray-500 dark:text-[#8696a0] text-sm">
                    Sin sugerencias {showAll ? '' : 'pendientes '}por ahora. El sistema revisa conversaciones frías cada hora automáticamente.
                </p>
            ) : (
                <div className="space-y-3">
                    {suggestions.map(s => (
                        <div
                            key={s.id}
                            className="p-4 bg-white dark:bg-[#202c33] border border-gray-200 dark:border-[#374248] rounded-lg"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-medium text-gray-800 dark:text-[#e9edef]">{s.contactName}</h3>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#182229] text-gray-500 dark:text-[#8696a0]">
                                    {reasonLabels[s.reason]}
                                </span>
                                {s.status !== 'pending' && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'sent' ? 'bg-[#00a884]/20 text-[#00a884]' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                                        {s.status === 'sent' ? 'Enviado' : 'Descartado'}
                                    </span>
                                )}
                            </div>

                            {s.status === 'pending' ? (
                                <>
                                    <textarea
                                        value={editingText[s.id] ?? s.suggestedMessage}
                                        onChange={e => setEditingText(prev => ({ ...prev, [s.id]: e.target.value }))}
                                        rows={2}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-sm text-gray-800 dark:text-[#e9edef] resize-none"
                                    />
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button
                                            onClick={() => handleDiscard(s.id)}
                                            className="flex items-center gap-1 px-3 py-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-xs font-medium"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Descartar
                                        </button>
                                        <button
                                            onClick={() => handleApprove(s)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-[#00a884] text-white rounded-lg text-xs font-medium hover:bg-[#06cf9c]"
                                        >
                                            <Send className="w-3.5 h-3.5" /> Aprobar y enviar
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-gray-600 dark:text-[#d1d7db]">{s.sentMessage || s.suggestedMessage}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
