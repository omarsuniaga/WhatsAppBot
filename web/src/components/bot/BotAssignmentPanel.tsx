/**
 * BotAssignmentPanel - Configure bot behavior for a specific chat
 */
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import {
    X,
    Bot,
    Smile,
    Briefcase,
    GraduationCap,
    Brain,
    AlertTriangle,
    MessageSquare,
    TrendingUp,
    Loader2,
    Save
} from 'lucide-react';
import { botAssignmentApi } from '../../api/client';

interface BotConfig {
    enabled: boolean;
    personality: 'professional' | 'friendly' | 'formal';
    language: string;
    customGreeting?: string;
    customFallback?: string;
    allowedCategories: string[];
    maxResponseLength: number;
    responseDelayMs: number;
    autoEscalate: boolean;
    escalateThreshold: number;
    learningEnabled: boolean;
}

interface BotStats {
    totalMessages: number;
    autoResponses: number;
    escalations: number;
    learnedResponses: number;
}

interface BotAssignment {
    id: string;
    chatJid: string;
    chatName: string;
    isGroup: boolean;
    botConfig: BotConfig;
    stats: BotStats;
    createdAt: string;
    updatedAt: string;
}

interface BotAssignmentPanelProps {
    isOpen: boolean;
    onClose: () => void;
    chatJid: string;
    chatName: string;
    isGroup?: boolean;
}

const personalityOptions = [
    { value: 'professional', label: 'Profesional', icon: Briefcase, description: 'Respuestas claras y directas' },
    { value: 'friendly', label: 'Amigable', icon: Smile, description: 'Tono cálido y cercano' },
    { value: 'formal', label: 'Formal', icon: GraduationCap, description: 'Lenguaje formal y respetuoso' },
];

export const BotAssignmentPanel = ({
    isOpen,
    onClose,
    chatJid,
    chatName,
    isGroup = false
}: BotAssignmentPanelProps) => {
    const [assignment, setAssignment] = useState<BotAssignment | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Local config state
    const [config, setConfig] = useState<BotConfig>({
        enabled: false,
        personality: 'friendly',
        language: 'es',
        customGreeting: '',
        customFallback: '',
        allowedCategories: [],
        maxResponseLength: 500,
        responseDelayMs: 1500,
        autoEscalate: true,
        escalateThreshold: 0.7,
        learningEnabled: true
    });

    // Fetch assignment
    useEffect(() => {
        if (isOpen && chatJid) {
            fetchAssignment();
        }
    }, [isOpen, chatJid]);

    const fetchAssignment = async () => {
        try {
            setIsLoading(true);
            const response = await botAssignmentApi.getByJid(chatJid);
            if (response.data.success && response.data.data) {
                setAssignment(response.data.data);
                setConfig(response.data.data.botConfig);
            } else {
                // No assignment yet, use defaults
                const defaultResponse = await botAssignmentApi.getDefaultConfig();
                if (defaultResponse.data.success) {
                    setConfig(defaultResponse.data.data);
                }
            }
        } catch (error) {
            console.error('Error fetching assignment:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfigChange = <K extends keyof BotConfig>(key: K, value: BotConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await botAssignmentApi.createOrUpdate({
                chatJid,
                chatName,
                isGroup,
                botConfig: config
            });
            setHasChanges(false);
            // Refresh assignment
            await fetchAssignment();
        } catch (error) {
            console.error('Error saving assignment:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = async (enabled: boolean) => {
        try {
            await botAssignmentApi.toggleBot(chatJid, enabled, chatName);
            handleConfigChange('enabled', enabled);
            setHasChanges(false);
        } catch (error) {
            console.error('Error toggling bot:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/70"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="relative w-full max-w-lg max-h-[90vh] bg-[#111b21] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-[#202c33] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Bot className="w-6 h-6 text-[#00a884]" />
                        <div>
                            <h3 className="text-[#e9edef] font-medium">
                                Configuración del Bot
                            </h3>
                            <span className="text-xs text-[#8696a0]">
                                {chatName}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-[#aebac1] hover:bg-[#374248] rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="w-6 h-6 text-[#00a884] animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* Main toggle */}
                            <div className="flex items-center justify-between p-4 bg-[#202c33] rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Bot className={clsx(
                                        "w-8 h-8",
                                        config.enabled ? "text-[#00a884]" : "text-[#8696a0]"
                                    )} />
                                    <div>
                                        <span className="text-[#e9edef] font-medium">
                                            Bot activo
                                        </span>
                                        <p className="text-xs text-[#8696a0]">
                                            {config.enabled 
                                                ? 'El bot responderá automáticamente' 
                                                : 'El bot está desactivado para este chat'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleToggle(!config.enabled)}
                                    className={clsx(
                                        "w-12 h-6 rounded-full transition-colors relative",
                                        config.enabled ? "bg-[#00a884]" : "bg-[#374248]"
                                    )}
                                >
                                    <span className={clsx(
                                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                                        config.enabled ? "right-1" : "left-1"
                                    )} />
                                </button>
                            </div>

                            {config.enabled && (
                                <>
                                    {/* Personality */}
                                    <div>
                                        <h4 className="text-sm font-medium text-[#8696a0] mb-3">
                                            Personalidad
                                        </h4>
                                        <div className="grid grid-cols-3 gap-2">
                                            {personalityOptions.map((option) => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => handleConfigChange('personality', option.value as BotConfig['personality'])}
                                                    className={clsx(
                                                        "p-3 rounded-lg text-center transition-colors",
                                                        config.personality === option.value
                                                            ? "bg-[#00a884] text-white"
                                                            : "bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]"
                                                    )}
                                                >
                                                    <option.icon className="w-5 h-5 mx-auto mb-1" />
                                                    <span className="text-xs">{option.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Escalation threshold */}
                                    <div>
                                        <h4 className="text-sm font-medium text-[#8696a0] mb-3 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            Umbral de confianza
                                        </h4>
                                        <p className="text-xs text-[#8696a0] mb-2">
                                            Si la confianza es menor a este valor, se escalará a un humano
                                        </p>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="range"
                                                min="0.3"
                                                max="0.9"
                                                step="0.1"
                                                value={config.escalateThreshold}
                                                onChange={(e) => handleConfigChange('escalateThreshold', parseFloat(e.target.value))}
                                                className="flex-1 accent-[#00a884]"
                                            />
                                            <span className="text-[#e9edef] font-medium w-12 text-right">
                                                {Math.round(config.escalateThreshold * 100)}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Auto escalate toggle */}
                                    <div className="flex items-center justify-between p-4 bg-[#202c33] rounded-lg">
                                        <div>
                                            <span className="text-[#e9edef] font-medium flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                                Escalación automática
                                            </span>
                                            <p className="text-xs text-[#8696a0]">
                                                Crear alerta cuando no pueda responder
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleConfigChange('autoEscalate', !config.autoEscalate)}
                                            className={clsx(
                                                "w-12 h-6 rounded-full transition-colors relative",
                                                config.autoEscalate ? "bg-[#00a884]" : "bg-[#374248]"
                                            )}
                                        >
                                            <span className={clsx(
                                                "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                                                config.autoEscalate ? "right-1" : "left-1"
                                            )} />
                                        </button>
                                    </div>

                                    {/* Learning toggle */}
                                    <div className="flex items-center justify-between p-4 bg-[#202c33] rounded-lg">
                                        <div>
                                            <span className="text-[#e9edef] font-medium flex items-center gap-2">
                                                <Brain className="w-4 h-4 text-[#00a884]" />
                                                Aprendizaje automático
                                            </span>
                                            <p className="text-xs text-[#8696a0]">
                                                Aprender de las respuestas humanas
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleConfigChange('learningEnabled', !config.learningEnabled)}
                                            className={clsx(
                                                "w-12 h-6 rounded-full transition-colors relative",
                                                config.learningEnabled ? "bg-[#00a884]" : "bg-[#374248]"
                                            )}
                                        >
                                            <span className={clsx(
                                                "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                                                config.learningEnabled ? "right-1" : "left-1"
                                            )} />
                                        </button>
                                    </div>

                                    {/* Custom fallback message */}
                                    <div>
                                        <h4 className="text-sm font-medium text-[#8696a0] mb-3 flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4" />
                                            Mensaje cuando escala
                                        </h4>
                                        <textarea
                                            value={config.customFallback || ''}
                                            onChange={(e) => handleConfigChange('customFallback', e.target.value)}
                                            placeholder="Un momento, estoy consultando con mi equipo..."
                                            rows={2}
                                            className="w-full px-3 py-2 bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#00a884] text-sm"
                                        />
                                    </div>

                                    {/* Stats */}
                                    {assignment?.stats && (
                                        <div>
                                            <h4 className="text-sm font-medium text-[#8696a0] mb-3 flex items-center gap-2">
                                                <TrendingUp className="w-4 h-4" />
                                                Estadísticas
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 bg-[#202c33] rounded-lg text-center">
                                                    <span className="text-2xl font-bold text-[#e9edef]">
                                                        {assignment.stats.totalMessages}
                                                    </span>
                                                    <p className="text-xs text-[#8696a0]">Mensajes</p>
                                                </div>
                                                <div className="p-3 bg-[#202c33] rounded-lg text-center">
                                                    <span className="text-2xl font-bold text-[#00a884]">
                                                        {assignment.stats.autoResponses}
                                                    </span>
                                                    <p className="text-xs text-[#8696a0]">Auto-respuestas</p>
                                                </div>
                                                <div className="p-3 bg-[#202c33] rounded-lg text-center">
                                                    <span className="text-2xl font-bold text-yellow-500">
                                                        {assignment.stats.escalations}
                                                    </span>
                                                    <p className="text-xs text-[#8696a0]">Escalaciones</p>
                                                </div>
                                                <div className="p-3 bg-[#202c33] rounded-lg text-center">
                                                    <span className="text-2xl font-bold text-purple-400">
                                                        {assignment.stats.learnedResponses}
                                                    </span>
                                                    <p className="text-xs text-[#8696a0]">Aprendidas</p>
                                                </div>
                                            </div>
                                            {assignment.stats.totalMessages > 0 && (
                                                <p className="text-xs text-[#8696a0] mt-2 text-center">
                                                    Tasa de auto-respuesta: {Math.round((assignment.stats.autoResponses / assignment.stats.totalMessages) * 100)}%
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                {hasChanges && (
                    <div className="px-6 py-4 bg-[#202c33] flex items-center justify-end gap-3">
                        <button
                            onClick={() => {
                                if (assignment) {
                                    setConfig(assignment.botConfig);
                                }
                                setHasChanges(false);
                            }}
                            className="px-4 py-2 text-[#8696a0] hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2 bg-[#00a884] hover:bg-[#06cf9c] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                            {isSaving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            Guardar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
