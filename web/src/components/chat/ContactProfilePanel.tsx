/**
 * ContactProfilePanel - Fase A of docs/SPEC_CONVERSACION_GUIADA.md
 * Shows the lightweight conversation context (contact profile, detected
 * intent, rolling summary) tracked per chat, and lets a human edit the
 * profile fields used to guide tone and future guided flows.
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Save, UserCircle, Ban } from 'lucide-react';
import { conversationContextApi } from '../../api/client';

type RelationType = 'cliente_hotel' | 'amigo' | 'alumno' | 'institucional' | 'desconocido';

interface ConversationContext {
    chatJid: string;
    contactProfile: {
        displayName: string;
        relationType: RelationType;
        preferredLanguage: 'es' | 'en';
        tags: string[];
    };
    state: string;
    detectedIntent?: {
        label: string;
        confidence: number;
        entities: Record<string, string>;
    };
    lastInboundAt: string | null;
    lastOutboundAt: string | null;
    summary: string;
    optedOut: boolean;
}

interface ContactProfilePanelProps {
    isOpen: boolean;
    onClose: () => void;
    chatJid: string;
    chatName: string;
}

const relationLabels: Record<RelationType, string> = {
    cliente_hotel: 'Cliente / hotel',
    amigo: 'Amigo',
    alumno: 'Alumno',
    institucional: 'Institucional',
    desconocido: 'Desconocido'
};

export const ContactProfilePanel = ({ isOpen, onClose, chatJid, chatName }: ContactProfilePanelProps) => {
    const [context, setContext] = useState<ConversationContext | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [relationType, setRelationType] = useState<RelationType>('desconocido');
    const [preferredLanguage, setPreferredLanguage] = useState<'es' | 'en'>('es');
    const [tagsInput, setTagsInput] = useState('');

    useEffect(() => {
        if (isOpen && chatJid) {
            fetchContext();
        }
    }, [isOpen, chatJid]);

    const fetchContext = async () => {
        setIsLoading(true);
        try {
            const response = await conversationContextApi.getByChat(chatJid);
            if (response.data.success) {
                const data: ConversationContext = response.data.data;
                setContext(data);
                setRelationType(data.contactProfile.relationType);
                setPreferredLanguage(data.contactProfile.preferredLanguage);
                setTagsInput(data.contactProfile.tags.join(', '));
            }
        } catch (error) {
            // No context yet: the bot creates one on the first inbound message
            setContext(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
            const response = await conversationContextApi.updateProfile(chatJid, {
                relationType,
                preferredLanguage,
                tags
            });
            if (response.data.success) {
                setContext(response.data.data);
            }
        } catch (error) {
            console.error('Error saving contact profile:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleOptOut = async () => {
        if (!context) return;
        try {
            const response = await conversationContextApi.setOptedOut(chatJid, !context.optedOut);
            if (response.data.success) {
                setContext(response.data.data);
            }
        } catch (error) {
            console.error('Error updating opt-out status:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-[#202c33] rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden shadow-xl transition-colors">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#374248]">
                    <div className="flex items-center gap-2">
                        <UserCircle className="w-5 h-5 text-[#00a884]" />
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800 dark:text-[#e9edef]">
                                Perfil de contacto
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-[#8696a0] truncate max-w-[280px]">
                                {chatName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-500 dark:text-[#aebac1] hover:bg-gray-100 dark:hover:bg-[#374248] rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto max-h-[500px] space-y-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-[#00a884] animate-spin" />
                        </div>
                    ) : !context ? (
                        <p className="text-sm text-gray-500 dark:text-[#8696a0] text-center py-8">
                            Aún no hay contexto registrado para este chat. Se crea automáticamente
                            cuando el contacto envía su primer mensaje.
                        </p>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">
                                    Tipo de relación
                                </label>
                                <select
                                    value={relationType}
                                    onChange={(e) => setRelationType(e.target.value as RelationType)}
                                    className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-gray-800 dark:text-[#e9edef] text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                                >
                                    {(Object.keys(relationLabels) as RelationType[]).map(key => (
                                        <option key={key} value={key}>{relationLabels[key]}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">
                                    Idioma preferido
                                </label>
                                <select
                                    value={preferredLanguage}
                                    onChange={(e) => setPreferredLanguage(e.target.value as 'es' | 'en')}
                                    className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-gray-800 dark:text-[#e9edef] text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                                >
                                    <option value="es">Español</option>
                                    <option value="en">Inglés</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">
                                    Etiquetas (separadas por coma)
                                </label>
                                <input
                                    type="text"
                                    value={tagsInput}
                                    onChange={(e) => setTagsInput(e.target.value)}
                                    placeholder="hotel-riu, evento-anual"
                                    className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-gray-800 dark:text-[#e9edef] text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] placeholder-gray-400 dark:placeholder-[#8696a0]"
                                />
                            </div>

                            <div className="p-3 bg-gray-50 dark:bg-[#182229] rounded-lg space-y-2 text-sm">
                                <p className="text-gray-500 dark:text-[#8696a0]">
                                    Estado: <span className="text-gray-800 dark:text-[#e9edef]">{context.state}</span>
                                </p>
                                {context.detectedIntent && (
                                    <p className="text-gray-500 dark:text-[#8696a0]">
                                        Última intención detectada: <span className="text-gray-800 dark:text-[#e9edef]">{context.detectedIntent.label}</span>
                                        {Object.keys(context.detectedIntent.entities).length > 0 && (
                                            <span className="text-gray-800 dark:text-[#e9edef]">
                                                {' '}({Object.entries(context.detectedIntent.entities).map(([k, v]) => `${k}: ${v}`).join(', ')})
                                            </span>
                                        )}
                                    </p>
                                )}
                                {context.summary && (
                                    <div>
                                        <p className="text-gray-500 dark:text-[#8696a0] mb-1">Resumen de la conversación:</p>
                                        <p className="text-gray-800 dark:text-[#e9edef] whitespace-pre-line text-xs">{context.summary}</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleToggleOptOut}
                                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    context.optedOut
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                        : 'bg-gray-100 dark:bg-[#182229] text-gray-600 dark:text-[#aebac1] hover:bg-gray-200 dark:hover:bg-[#374248]'
                                }`}
                            >
                                <Ban className="w-4 h-4" />
                                {context.optedOut
                                    ? 'No recibirá mensajes de seguimiento (click para reactivar)'
                                    : 'Marcar como "no volver a contactar"'}
                            </button>
                        </>
                    )}
                </div>

                <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-[#374248]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 dark:text-[#aebac1] hover:bg-gray-100 dark:hover:bg-[#374248] rounded-lg text-sm font-medium transition-colors"
                    >
                        Cerrar
                    </button>
                    {context && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-[#00a884] text-white rounded-lg text-sm font-medium hover:bg-[#06cf9c] disabled:opacity-50 transition-colors"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
