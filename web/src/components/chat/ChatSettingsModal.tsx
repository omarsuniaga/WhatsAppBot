import { useState, useEffect } from 'react';
import { X, Bell, BellOff, MessageSquare, Tag, Clock, Zap, Save } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatSettings {
    notifications: {
        enabled: boolean;
        sound: boolean;
        priority: 'normal' | 'high' | 'muted';
    };
    autoResponses: {
        enabled: boolean;
        awayMessage: string;
        businessHoursOnly: boolean;
        customTriggers: Array<{
            trigger: string;
            response: string;
            enabled: boolean;
        }>;
    };
    tags: string[];
    notes: string;
}

interface ChatSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    chatJid: string;
    chatName: string;
}

const defaultSettings: ChatSettings = {
    notifications: {
        enabled: true,
        sound: true,
        priority: 'normal'
    },
    autoResponses: {
        enabled: false,
        awayMessage: '',
        businessHoursOnly: false,
        customTriggers: []
    },
    tags: [],
    notes: ''
};

export const ChatSettingsModal = ({ isOpen, onClose, chatJid, chatName }: ChatSettingsModalProps) => {
    const [settings, setSettings] = useState<ChatSettings>(defaultSettings);
    const [activeTab, setActiveTab] = useState<'notifications' | 'autoresponse' | 'tags'>('notifications');
    const [newTag, setNewTag] = useState('');
    const [newTrigger, setNewTrigger] = useState({ trigger: '', response: '' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && chatJid) {
            // Load settings from localStorage
            const saved = localStorage.getItem(`chat-settings-${chatJid}`);
            if (saved) {
                try {
                    setSettings(JSON.parse(saved));
                } catch {
                    setSettings(defaultSettings);
                }
            } else {
                setSettings(defaultSettings);
            }
        }
    }, [isOpen, chatJid]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            localStorage.setItem(`chat-settings-${chatJid}`, JSON.stringify(settings));
            // TODO: Sync with backend if needed
            setTimeout(() => {
                setIsSaving(false);
                onClose();
            }, 300);
        } catch (error) {
            console.error('Error saving settings:', error);
            setIsSaving(false);
        }
    };

    const addTag = () => {
        if (newTag.trim() && !settings.tags.includes(newTag.trim())) {
            setSettings(prev => ({
                ...prev,
                tags: [...prev.tags, newTag.trim()]
            }));
            setNewTag('');
        }
    };

    const removeTag = (tag: string) => {
        setSettings(prev => ({
            ...prev,
            tags: prev.tags.filter(t => t !== tag)
        }));
    };

    const addTrigger = () => {
        if (newTrigger.trigger.trim() && newTrigger.response.trim()) {
            setSettings(prev => ({
                ...prev,
                autoResponses: {
                    ...prev.autoResponses,
                    customTriggers: [
                        ...prev.autoResponses.customTriggers,
                        { ...newTrigger, enabled: true }
                    ]
                }
            }));
            setNewTrigger({ trigger: '', response: '' });
        }
    };

    const removeTrigger = (index: number) => {
        setSettings(prev => ({
            ...prev,
            autoResponses: {
                ...prev.autoResponses,
                customTriggers: prev.autoResponses.customTriggers.filter((_, i) => i !== index)
            }
        }));
    };

    if (!isOpen) return null;

    const tabs = [
        { id: 'notifications', label: 'Notificaciones', icon: Bell },
        { id: 'autoresponse', label: 'Auto-respuestas', icon: MessageSquare },
        { id: 'tags', label: 'Etiquetas y Notas', icon: Tag }
    ] as const;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-[#202c33] rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl transition-colors">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#374248]">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-[#e9edef]">
                            Configuración del Chat
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-[#8696a0] truncate max-w-[300px]">
                            {chatName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-500 dark:text-[#aebac1] hover:bg-gray-100 dark:hover:bg-[#374248] rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-[#374248]">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                                activeTab === tab.id
                                    ? 'text-[#00a884] border-b-2 border-[#00a884] bg-gray-50 dark:bg-[#182229]'
                                    : 'text-gray-500 dark:text-[#8696a0] hover:bg-gray-50 dark:hover:bg-[#182229]'
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[400px]">
                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#182229] rounded-lg">
                                <div className="flex items-center gap-3">
                                    {settings.notifications.enabled ? (
                                        <Bell className="w-5 h-5 text-[#00a884]" />
                                    ) : (
                                        <BellOff className="w-5 h-5 text-gray-400" />
                                    )}
                                    <div>
                                        <p className="text-sm font-medium text-gray-800 dark:text-[#e9edef]">
                                            Notificaciones
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-[#8696a0]">
                                            Recibir alertas de este chat
                                        </p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.notifications.enabled}
                                        onChange={(e) => setSettings(prev => ({
                                            ...prev,
                                            notifications: { ...prev.notifications, enabled: e.target.checked }
                                        }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00a884]"></div>
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">
                                    Prioridad
                                </label>
                                <select
                                    value={settings.notifications.priority}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        notifications: { ...prev.notifications, priority: e.target.value as 'normal' | 'high' | 'muted' }
                                    }))}
                                    className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-gray-800 dark:text-[#e9edef] text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                                >
                                    <option value="high">Alta - Siempre notificar</option>
                                    <option value="normal">Normal</option>
                                    <option value="muted">Silenciado</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Auto-response Tab */}
                    {activeTab === 'autoresponse' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#182229] rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Zap className={clsx('w-5 h-5', settings.autoResponses.enabled ? 'text-[#00a884]' : 'text-gray-400')} />
                                    <div>
                                        <p className="text-sm font-medium text-gray-800 dark:text-[#e9edef]">
                                            Respuestas automáticas
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-[#8696a0]">
                                            Activar para este contacto
                                        </p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.autoResponses.enabled}
                                        onChange={(e) => setSettings(prev => ({
                                            ...prev,
                                            autoResponses: { ...prev.autoResponses, enabled: e.target.checked }
                                        }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00a884]"></div>
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">
                                    Mensaje de ausencia
                                </label>
                                <textarea
                                    value={settings.autoResponses.awayMessage}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        autoResponses: { ...prev.autoResponses, awayMessage: e.target.value }
                                    }))}
                                    placeholder="Ej: Gracias por escribir, te responderé pronto..."
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-gray-800 dark:text-[#e9edef] text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] placeholder-gray-400 dark:placeholder-[#8696a0] resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#182229] rounded-lg">
                                <Clock className="w-5 h-5 text-gray-400" />
                                <div className="flex-1">
                                    <p className="text-sm text-gray-800 dark:text-[#e9edef]">
                                        Solo en horario laboral
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.autoResponses.businessHoursOnly}
                                        onChange={(e) => setSettings(prev => ({
                                            ...prev,
                                            autoResponses: { ...prev.autoResponses, businessHoursOnly: e.target.checked }
                                        }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00a884]"></div>
                                </label>
                            </div>

                            {/* Custom triggers */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">
                                    Respuestas personalizadas
                                </label>
                                
                                {settings.autoResponses.customTriggers.map((t, idx) => (
                                    <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-[#182229] rounded-lg">
                                        <div className="flex-1 text-sm">
                                            <p className="text-gray-500 dark:text-[#8696a0]">Si dice: <span className="text-gray-800 dark:text-[#e9edef]">"{t.trigger}"</span></p>
                                            <p className="text-gray-500 dark:text-[#8696a0]">Responder: <span className="text-gray-800 dark:text-[#e9edef]">"{t.response}"</span></p>
                                        </div>
                                        <button
                                            onClick={() => removeTrigger(idx)}
                                            className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}

                                <div className="space-y-2 p-3 border border-dashed border-gray-300 dark:border-[#374248] rounded-lg">
                                    <input
                                        type="text"
                                        value={newTrigger.trigger}
                                        onChange={(e) => setNewTrigger(prev => ({ ...prev, trigger: e.target.value }))}
                                        placeholder="Palabra clave (ej: precio)"
                                        className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-gray-800 dark:text-[#e9edef] text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] placeholder-gray-400 dark:placeholder-[#8696a0]"
                                    />
                                    <input
                                        type="text"
                                        value={newTrigger.response}
                                        onChange={(e) => setNewTrigger(prev => ({ ...prev, response: e.target.value }))}
                                        placeholder="Respuesta automática"
                                        className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-gray-800 dark:text-[#e9edef] text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] placeholder-gray-400 dark:placeholder-[#8696a0]"
                                    />
                                    <button
                                        onClick={addTrigger}
                                        disabled={!newTrigger.trigger.trim() || !newTrigger.response.trim()}
                                        className="w-full px-3 py-2 bg-[#00a884] text-white rounded-lg text-sm font-medium hover:bg-[#06cf9c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Agregar respuesta
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tags Tab */}
                    {activeTab === 'tags' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">
                                    Etiquetas
                                </label>
                                <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-gray-50 dark:bg-[#182229] rounded-lg">
                                    {settings.tags.map(tag => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-[#00a884]/20 text-[#00a884] text-sm rounded-full"
                                        >
                                            {tag}
                                            <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                    {settings.tags.length === 0 && (
                                        <span className="text-sm text-gray-400 dark:text-[#8696a0]">Sin etiquetas</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                                        placeholder="Nueva etiqueta..."
                                        className="flex-1 px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-gray-800 dark:text-[#e9edef] text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] placeholder-gray-400 dark:placeholder-[#8696a0]"
                                    />
                                    <button
                                        onClick={addTag}
                                        disabled={!newTag.trim()}
                                        className="px-4 py-2 bg-[#00a884] text-white rounded-lg text-sm font-medium hover:bg-[#06cf9c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Agregar
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">
                                    Notas sobre este contacto
                                </label>
                                <textarea
                                    value={settings.notes}
                                    onChange={(e) => setSettings(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Agrega notas privadas sobre este contacto..."
                                    rows={4}
                                    className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-gray-800 dark:text-[#e9edef] text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] placeholder-gray-400 dark:placeholder-[#8696a0] resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-[#374248]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 dark:text-[#aebac1] hover:bg-gray-100 dark:hover:bg-[#374248] rounded-lg text-sm font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-[#00a884] text-white rounded-lg text-sm font-medium hover:bg-[#06cf9c] disabled:opacity-50 transition-colors"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
