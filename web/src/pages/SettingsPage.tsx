/**
 * SettingsPage - Application Settings
 * Displays configuration options for Knowledge Base, Escalation, and Broadcast
 */

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { BookOpen, Ticket, RefreshCw, HelpCircle, X, ChevronDown, ChevronRight, Bot, Brain, MessageSquare, Zap, Check, Settings, Terminal } from 'lucide-react';
import { knowledgeApi, escalationApi, broadcastApi } from '../api/client';
import { GeminiConfigPanel } from '../components/settings/GeminiConfigPanel';
import { BotDiagnosticTool, TriggerManager, KnowledgeBaseManager, RealTimeLogMonitor } from '../components/bot';
import {
    useLocalStorage,
    STORAGE_KEYS,
    DEFAULT_CONFIGS,
    KnowledgeConfig,
    EscalationConfig,
    BroadcastConfig
} from '../hooks/useLocalStorage';

// ============================================
// System Setup Guide Component
// ============================================
const SystemSetupGuide = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [expandedSection, setExpandedSection] = useState<string | null>('overview');

    if (!isOpen) return null;

    const toggleSection = (id: string) => {
        setExpandedSection(expandedSection === id ? null : id);
    };

    const sections = [
        {
            id: 'overview',
            icon: <Zap className="w-5 h-5 text-yellow-500" />,
            title: '¿Cómo funciona el sistema?',
            content: (
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <p>Tu bot de WhatsApp funciona en 4 pasos automáticos:</p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                        <li><strong>Clasificación:</strong> Cuando un cliente envía un mensaje, el sistema lo clasifica automáticamente (saludo, consulta de precio, queja, etc.)</li>
                        <li><strong>Búsqueda en KB:</strong> El bot busca una respuesta en tu Base de Conocimiento (FAQs)</li>
                        <li><strong>Respuesta con IA:</strong> Si no encuentra respuesta en la KB, usa Gemini AI para generar una respuesta contextual</li>
                        <li><strong>Escalación:</strong> Si ninguna opción funciona, crea un ticket para que un humano responda</li>
                    </ol>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 mt-3">
                        <p className="text-blue-700 dark:text-blue-300 font-medium text-xs">
                            El bot aprende de las respuestas humanas: cuando respondes un ticket, la respuesta puede agregarse automáticamente a la KB para futuras consultas.
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'gemini',
            icon: <Brain className="w-5 h-5 text-purple-500" />,
            title: 'Paso 1: Configurar Gemini AI',
            content: (
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <p>Gemini AI potencia la clasificación de intenciones y las respuestas inteligentes.</p>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg space-y-2">
                        <p className="font-medium text-gray-800 dark:text-gray-100">Para obtener tu API Key:</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                            <li>Ve a <span className="font-mono bg-gray-200 dark:bg-gray-600 px-1 rounded">aistudio.google.com</span></li>
                            <li>Inicia sesión con tu cuenta de Google</li>
                            <li>Haz clic en "Get API key" → "Create API key"</li>
                            <li>Copia la clave generada</li>
                            <li>Pégala en la sección "Configuración de IA (Gemini)" más abajo</li>
                        </ol>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-amber-700 dark:text-amber-300 text-xs">
                            <strong>Sin Gemini:</strong> El bot solo responde desde la KB con coincidencia de palabras clave. Con Gemini: obtiene clasificación semántica, respuestas generadas por IA y mejores variaciones de preguntas.
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'kb',
            icon: <BookOpen className="w-5 h-5 text-blue-500" />,
            title: 'Paso 2: Llenar la Base de Conocimiento',
            content: (
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <p>La KB es el cerebro del bot. Cuanto más completa, mejor responde.</p>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg space-y-2">
                        <p className="font-medium text-gray-800 dark:text-gray-100">Cómo agregar FAQs:</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                            <li>Ve a <strong>Base de Conocimiento</strong> en el menú lateral</li>
                            <li>Haz clic en "Agregar FAQ"</li>
                            <li>Escribe la pregunta principal y variaciones</li>
                            <li>Escribe la respuesta completa</li>
                            <li>Agrega palabras clave relevantes</li>
                            <li>Selecciona una categoría</li>
                        </ol>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-green-700 dark:text-green-300 text-xs">
                            <strong>Tip:</strong> Agrega al menos 3-5 variaciones de cada pregunta. Ejemplo: "¿Cuánto cuesta?", "¿Cuál es el precio?", "¿Qué valor tiene?", "precio de clases".
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'broadcast',
            icon: <Zap className="w-5 h-5 text-green-500" />, // Replaced 'Send' with 'Zap' as 'Send' was not imported and 'Zap' is already imported and visually similar for "broadcast"
            title: 'Paso 3: Programar Mensajes Masivos',
            content: (
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <p>Envía mensajes a grupos de contactos de forma manual o programada.</p>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg space-y-2">
                        <p className="font-medium text-gray-800 dark:text-gray-100">Para programar un envío:</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                            <li>Ve a <strong>Mensajes Masivos</strong></li>
                            <li>Crea una <strong>Lista de Contactos</strong> (pestaña "Listas")</li>
                            <li>Opcionalmente, crea una <strong>Plantilla</strong> (pestaña "Plantillas")</li>
                            <li>Crea una <strong>Campaña</strong> (pestaña "Campañas")</li>
                            <li>Selecciona la lista de contactos y el mensaje/plantilla</li>
                            <li>Elige "Programar" y selecciona fecha y hora (8am-8pm)</li>
                            <li>El sistema ejecutará la campaña automáticamente</li>
                        </ol>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-amber-700 dark:text-amber-300 text-xs">
                            <strong>Importante:</strong> Los mensajes se envían con un delay de 2-5 segundos entre cada uno para evitar que WhatsApp bloquee el número. Una campaña de 100 contactos toma aprox. 5 minutos.
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'tickets',
            icon: <Ticket className="w-5 h-5 text-orange-500" />,
            title: 'Paso 4: Gestionar Tickets y Aprendizaje',
            content: (
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <p>Cuando el bot no puede responder, crea un ticket automáticamente.</p>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg space-y-2">
                        <p className="font-medium text-gray-800 dark:text-gray-100">Flujo de aprendizaje:</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                            <li>El cliente pregunta algo que el bot no sabe → se crea un <strong>Ticket</strong></li>
                            <li>Tú respondes el ticket manualmente</li>
                            <li>Si marcas "Aprender de esta respuesta", el sistema crea una nueva FAQ</li>
                            <li>La próxima vez que alguien pregunte lo mismo, el bot responderá automáticamente</li>
                        </ol>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                        <p className="text-purple-700 dark:text-purple-300 text-xs">
                            <strong>Auto-aprobación:</strong> Puedes activar que las respuestas aprendidas se agreguen automáticamente a la KB sin revisión manual. Esto acelera el aprendizaje pero debes asegurarte de dar respuestas de calidad.
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'whatsapp',
            icon: <MessageSquare className="w-5 h-5 text-whatsapp-green" />,
            title: 'Conexión de WhatsApp',
            content: (
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <p>El bot se conecta a WhatsApp mediante el escaneo de un código QR.</p>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg space-y-2">
                        <p className="font-medium text-gray-800 dark:text-gray-100">Para conectar:</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                            <li>Ve a <strong>Gestión WhatsApp</strong> en el menú lateral</li>
                            <li>Si no está conectado, aparecerá un código QR</li>
                            <li>Abre WhatsApp en tu teléfono → Ajustes → Dispositivos vinculados</li>
                            <li>Escanea el código QR</li>
                            <li>¡Listo! El bot comenzará a recibir y procesar mensajes</li>
                        </ol>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-red-700 dark:text-red-300 text-xs">
                            <strong>Precaución:</strong> El bot usa la API no oficial de WhatsApp (Baileys). No es recomendable usarlo en números de WhatsApp personales. Usa un número dedicado para el bot.
                        </p>
                    </div>
                </div>
            )
        }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-whatsapp-green to-green-600 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <Bot className="w-6 h-6" />
                        <div>
                            <h2 className="text-lg font-bold">Guía de Configuración</h2>
                            <p className="text-green-100 text-xs">Cómo configurar tu bot de WhatsApp</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="hover:bg-white/20 rounded-full p-1.5 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {sections.map((section) => (
                        <div key={section.id} className="border dark:border-gray-700 rounded-lg overflow-hidden">
                            <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                            >
                                {section.icon}
                                <span className="font-medium text-gray-800 dark:text-gray-100 flex-1 text-sm">
                                    {section.title}
                                </span>
                                {expandedSection === section.id
                                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                                    : <ChevronRight className="w-4 h-4 text-gray-400" />
                                }
                            </button>
                            {expandedSection === section.id && (
                                <div className="px-4 pb-4 pt-1 border-t dark:border-gray-700">
                                    {section.content}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-whatsapp-green text-white rounded-lg hover:bg-green-600 transition-colors font-medium text-sm"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// Settings Page
// ============================================

export const SettingsPage = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [showGuide, setShowGuide] = useState(false);
    const [activeTab, setActiveTab] = useState<'automation' | 'knowledge' | 'bot' | 'system' | 'diagnostics'>('automation');

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

    const tabs = [
        { id: 'automation', label: 'Automatización', icon: <Zap className="w-4 h-4" /> },
        { id: 'knowledge', label: 'Base de Conocimiento', icon: <BookOpen className="w-4 h-4" /> },
        { id: 'bot', label: 'Chatbot', icon: <Bot className="w-4 h-4" /> },
        { id: 'diagnostics', label: 'Diagnóstico', icon: <Terminal className="w-4 h-4 text-orange-500" /> },
        { id: 'system', label: 'Sistema', icon: <Settings className="w-4 h-4" /> },
    ];

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 bg-[#f0f2f5] dark:bg-[#111b21]">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-[#e9edef]">Gestor de Comunicaciones</h2>
                        <p className="text-sm text-gray-500 dark:text-[#8696a0]">Configura el comportamiento y la inteligencia de tu bot</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowGuide(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-whatsapp-green/10 hover:bg-whatsapp-green/20 text-whatsapp-green rounded-lg transition-colors text-sm font-medium"
                        >
                            <HelpCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">Guía</span>
                        </button>
                        <button
                            onClick={loadConfig}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-[#202c33] rounded-lg text-gray-600 dark:text-[#8696a0] transition-colors"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* System Setup Guide */}
                <SystemSetupGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />

                {/* Tabs Navigation */}
                <div className="flex border-b border-gray-200 dark:border-[#374248] mb-6 overflow-x-auto no-scrollbar">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={clsx(
                                "flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                                activeTab === tab.id
                                    ? "border-whatsapp-green text-whatsapp-green bg-whatsapp-green/5"
                                    : "border-transparent text-gray-500 dark:text-[#8696a0] hover:text-gray-700 dark:hover:text-[#e9edef] hover:bg-gray-50 dark:hover:bg-[#202c33]"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {message && (
                    <div className={clsx(
                        "mb-6 p-4 rounded-lg border flex items-center gap-3 animate-in fade-in slide-in-from-top-2",
                        message.type === 'success'
                            ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30 text-green-700 dark:text-green-400"
                            : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-400"
                    )}>
                        <div className={clsx("w-2 h-2 rounded-full", message.type === 'success' ? "bg-green-500" : "bg-red-500")} />
                        {message.text}
                    </div>
                )}

                <div className="space-y-6">
                    {/* Automation Tab */}
                    {activeTab === 'automation' && (
                        <div className="space-y-6 animate-fade-in-up">
                            {/* Diagnostic Tool (Collapsible-like but integrated) */}
                            <div className="bg-white dark:bg-[#202c33] rounded-xl shadow-sm border border-gray-100 dark:border-[#374248] overflow-hidden">
                                <div className="p-4 border-b border-gray-100 dark:border-[#374248] bg-gray-50/50 dark:bg-[#111b21]/50 flex items-center justify-between">
                                    <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-[#e9edef]">
                                        <Zap className="w-5 h-5 text-yellow-500" />
                                        Prueba de Diagnóstico
                                    </h3>
                                </div>
                                <div className="p-6">
                                    <BotDiagnosticTool />
                                </div>
                            </div>

                            {/* Trigger Manager */}
                            <div className="bg-white dark:bg-[#202c33] rounded-xl shadow-sm border border-gray-100 dark:border-[#374248] overflow-hidden">
                                <div className="p-4 border-b border-gray-100 dark:border-[#374248] bg-gray-50/50 dark:bg-[#111b21]/50 flex items-center justify-between">
                                    <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-[#e9edef]">
                                        <MessageSquare className="w-5 h-5 text-whatsapp-green" />
                                        Gestión de Palabras Clave (Triggers)
                                    </h3>
                                </div>
                                <div className="p-6">
                                    <TriggerManager />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Knowledge Base Tab */}
                    {activeTab === 'knowledge' && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="bg-white dark:bg-[#202c33] rounded-xl shadow-sm border border-gray-100 dark:border-[#374248] p-6">
                                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-gray-800 dark:text-[#e9edef]">
                                    <BookOpen className="w-5 h-5 text-blue-500" />
                                    Identidad del Negocio
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-[#8696a0]">
                                            Nombre del Negocio
                                        </label>
                                        <input
                                            type="text"
                                            value={knowledgeConfig.businessName}
                                            onChange={(e) => setKnowledgeConfig(prev => ({ ...prev, businessName: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#2a3942] border border-gray-200 dark:border-[#374248] rounded-lg focus:ring-2 focus:ring-whatsapp-green outline-none text-gray-800 dark:text-[#e9edef] transition-all"
                                            placeholder="Mi Empresa"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-[#8696a0]">
                                            Tono de Respuestas
                                        </label>
                                        <select
                                            value={knowledgeConfig.toneStyle}
                                            onChange={(e) => setKnowledgeConfig(prev => ({ ...prev, toneStyle: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#2a3942] border border-gray-200 dark:border-[#374248] rounded-lg focus:ring-2 focus:ring-whatsapp-green outline-none text-gray-800 dark:text-[#e9edef] transition-all"
                                        >
                                            <option value="professional">Profesional ✨</option>
                                            <option value="friendly">Amigable 😊</option>
                                            <option value="formal">Formal 👔</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Knowledge Base Manager */}
                            <div className="bg-white dark:bg-[#202c33] rounded-xl shadow-sm border border-gray-100 dark:border-[#374248] overflow-hidden">
                                <div className="p-4 border-b border-gray-100 dark:border-[#374248] bg-gray-50/50 dark:bg-[#111b21]/50 flex items-center justify-between">
                                    <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-[#e9edef]">
                                        <Brain className="w-5 h-5 text-blue-500" />
                                        Cerebro de Conocimientos & FAQs
                                    </h3>
                                </div>
                                <div className="p-6">
                                    <KnowledgeBaseManager />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bot AI Tab */}
                    {activeTab === 'bot' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-white dark:bg-[#202c33] rounded-xl shadow-sm border border-gray-100 dark:border-[#374248] p-6">
                                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-gray-800 dark:text-[#e9edef]">
                                    <Brain className="w-5 h-5 text-purple-500" />
                                    Configuración de IA (Gemini)
                                </h3>
                                <GeminiConfigPanel compact={true} />
                            </div>
                        </div>
                    )}

                    {/* Diagnostics Tab */}
                    {activeTab === 'diagnostics' && (
                        <div className="space-y-6 animate-fade-in-up">
                            {/* Pro Diagnostic Tool */}
                            <div className="bg-white dark:bg-[#202c33] rounded-xl shadow-sm border border-gray-100 dark:border-[#374248] overflow-hidden">
                                <div className="p-4 border-b border-gray-100 dark:border-[#374248] bg-gray-50/50 dark:bg-[#111b21]/50 flex items-center justify-between">
                                    <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-[#e9edef]">
                                        <Zap className="w-5 h-5 text-yellow-500" />
                                        Simulador de Chat Pro (IA)
                                    </h3>
                                </div>
                                <div className="p-6">
                                    <BotDiagnosticTool />
                                </div>
                            </div>

                            {/* Real-time Log Monitor */}
                            <div className="bg-white dark:bg-[#202c33] rounded-xl shadow-sm border border-gray-100 dark:border-[#374248] overflow-hidden">
                                <div className="p-4 border-b border-gray-100 dark:border-[#374248] bg-gray-50/50 dark:bg-[#111b21]/50 flex items-center justify-between">
                                    <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-[#e9edef]">
                                        <Terminal className="w-5 h-5 text-orange-500" />
                                        Monitor de Logs Real-Time
                                    </h3>
                                </div>
                                <div className="p-6">
                                    <RealTimeLogMonitor />
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'system' && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="bg-white dark:bg-[#202c33] rounded-xl shadow-sm border border-gray-100 dark:border-[#374248] p-6">
                                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-gray-800 dark:text-[#e9edef]">
                                    <Ticket className="w-5 h-5 text-orange-500" />
                                    Reglas del Sistema
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#111b21] rounded-xl transition-colors">
                                        <div>
                                            <p className="font-semibold text-gray-800 dark:text-[#e9edef]">Asignación Automática</p>
                                            <p className="text-sm text-gray-500 dark:text-[#8696a0]">Asigna tickets a humanos si el bot no sabe la respuesta</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={escalationConfig.autoAssign}
                                                onChange={(e) => setEscalationConfig(prev => ({ ...prev, autoAssign: e.target.checked }))}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 dark:bg-[#374248] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-whatsapp-green"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Global Save Button (Sticky/Fixed better?) */}
                    <div className="bg-white dark:bg-[#202c33] p-4 rounded-xl shadow-md border border-gray-100 dark:border-[#374248] sticky bottom-4 z-40">
                        <button
                            onClick={saveConfig}
                            disabled={saving}
                            className="w-full py-3.5 bg-whatsapp-green text-white rounded-lg hover:bg-green-600 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-bold shadow-lg shadow-green-500/20"
                        >
                            {saving ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    Guardando cambios...
                                </>
                            ) : (
                                <>
                                    <Check className="w-5 h-5" />
                                    Guardar Configuración Global
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
