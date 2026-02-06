/**
 * SettingsPage - Application Settings
 * Displays configuration options for Knowledge Base, Escalation, and Broadcast
 */

import { useState, useEffect } from 'react';
import { BookOpen, Ticket, RefreshCw, Key } from 'lucide-react';
import { knowledgeApi, escalationApi, broadcastApi } from '../api/client';
import { GeminiConfigPanel } from '../components/settings/GeminiConfigPanel';
import { 
    useLocalStorage, 
    STORAGE_KEYS, 
    DEFAULT_CONFIGS,
    KnowledgeConfig,
    EscalationConfig,
    BroadcastConfig
} from '../hooks/useLocalStorage';

export const SettingsPage = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    
    const [knowledgeConfig, setKnowledgeConfig] = useLocalStorage<KnowledgeConfig>(
        STORAGE_KEYS.KNOWLEDGE_CONFIG, 
        DEFAULT_CONFIGS.knowledge
    );

    const [escalationConfig, setEscalationConfig] = useLocalStorage<EscalationConfig>(
        STORAGE_KEYS.ESCALATION_CONFIG, 
        DEFAULT_CONFIGS.escalation
    );

    const [broadcastConfig, setBroadcastConfig] = useLocalStorage<BroadcastConfig>(
        STORAGE_KEYS.BROADCAST_CONFIG, 
        DEFAULT_CONFIGS.broadcast
    );

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const [knowledgeRes, escalationRes, broadcastRes] = await Promise.all([
                knowledgeApi.getConfig(),
                escalationApi.getConfig(),
                broadcastApi.getConfig()
            ]);

            if (knowledgeRes.data.success && knowledgeRes.data.data) {
                setKnowledgeConfig(prev => ({ ...prev, ...knowledgeRes.data.data }));
            }
            if (escalationRes.data.success && escalationRes.data.data) {
                setEscalationConfig(prev => ({ ...prev, ...escalationRes.data.data }));
            }
            if (broadcastRes.data.success && broadcastRes.data.data) {
                setBroadcastConfig(prev => ({ ...prev, ...broadcastRes.data.data }));
            }
        } catch (error) {
            console.error('Error loading config:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await Promise.all([
                knowledgeApi.updateConfig(knowledgeConfig),
                escalationApi.updateConfig(escalationConfig),
                broadcastApi.updateConfig(broadcastConfig)
            ]);
            setMessage({ type: 'success', text: 'Configuración guardada exitosamente' });
        } catch (error) {
            console.error('Error saving config:', error);
            setMessage({ type: 'error', text: 'Error al guardar la configuración' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-whatsapp-green" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-3 sm:p-6">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Configuración</h2>
                    <button
                        onClick={loadConfig}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
                        title="Recargar configuración"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {message && (
                    <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                        {message.text}
                    </div>
                )}
                
                <div className="space-y-6">
                    {/* Gemini AI Config */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 sm:p-6 transition-colors">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                            <Key className="w-5 h-5 text-purple-500" />
                            Configuración de IA (Gemini)
                        </h3>
                        <GeminiConfigPanel compact={true} />
                    </div>

                    {/* Knowledge Base Config */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 sm:p-6 transition-colors">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                            <BookOpen className="w-5 h-5 text-blue-500" />
                            Base de Conocimiento
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Nombre del Negocio
                                </label>
                                <input
                                    type="text"
                                    value={knowledgeConfig.businessName}
                                    onChange={(e) => setKnowledgeConfig(prev => ({ ...prev, businessName: e.target.value }))}
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-whatsapp-green bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                    placeholder="Mi Empresa"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Tono de Respuestas
                                </label>
                                <select 
                                    value={knowledgeConfig.toneStyle}
                                    onChange={(e) => setKnowledgeConfig(prev => ({ ...prev, toneStyle: e.target.value }))}
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-whatsapp-green bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                >
                                    <option value="professional">Profesional</option>
                                    <option value="friendly">Amigable</option>
                                    <option value="formal">Formal</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Escalation Config */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 sm:p-6 transition-colors">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                            <Ticket className="w-5 h-5 text-orange-500" />
                            Sistema de Escalación
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-800 dark:text-gray-100">Asignación Automática</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Asignar tickets automáticamente</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={escalationConfig.autoAssign}
                                        onChange={(e) => setEscalationConfig(prev => ({ ...prev, autoAssign: e.target.checked }))}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-whatsapp-green"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={saveConfig}
                        disabled={saving}
                        className="w-full py-3 bg-whatsapp-green text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            'Guardar Configuración'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
