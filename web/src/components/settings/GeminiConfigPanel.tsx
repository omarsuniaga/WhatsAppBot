/**
 * GeminiConfigPanel - Componente completo para configurar la API Key de Gemini
 * Incluye instrucciones paso a paso, validacion y prueba de conexion
 */
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import {
    Key,
    Eye,
    EyeOff,
    Check,
    AlertCircle,
    ExternalLink,
    Loader2,
    Sparkles,
    HelpCircle,
    Copy,
    CheckCircle2,
    XCircle,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Bot,
    Zap
} from 'lucide-react';
import { configApi } from '../../api/client';

interface GeminiConfigPanelProps {
    onConfigured?: () => void;
    compact?: boolean;
}

type ConnectionStatus = 'unknown' | 'checking' | 'connected' | 'error' | 'not_configured';

export const GeminiConfigPanel = ({ onConfigured, compact = false }: GeminiConfigPanelProps) => {
    const [geminiKey, setGeminiKey] = useState('');
    const [showGeminiKey, setShowGeminiKey] = useState(false);

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
    const [testResponse, setTestResponse] = useState<string | null>(null);
    const [showInstructions, setShowInstructions] = useState(false); // Default closed to save space
    const [copied, setCopied] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isConfigured, setIsConfigured] = useState(false);

    // Cargar estado inicial del backend
    useEffect(() => {
        checkCurrentConfig();
    }, []);

    const checkCurrentConfig = async () => {
        try {
            const response = await configApi.getAiApiKey();
            if (response.data?.success) {
                const config = response.data.aiConfig;
                setIsConfigured(config.hasGeminiKey || config.hasGroqKey);

                if (config.hasGeminiKey) setConnectionStatus('connected');
                else if (config.hasGroqKey) setConnectionStatus('connected');
                else setConnectionStatus('not_configured');

                // Update settings form
                // setPreferredProvider(config.preferredProvider || 'gemini');
                // setEnableFailover(config.enableFailover ?? true);

                // We don't get actual keys back, just masked or boolean presence
                // So we only update if we have a masked key to show, otherwise keep empty
                if (response.data.maskedKey && response.data.source === 'runtime') {
                    // This is tricky because maskedKey is just one of them. 
                    // Ideally we don't overwrite user input if they are typing.
                }
            }
        } catch (error: any) {
            console.error('Error checking config:', error);
            if (error.response?.status === 404) {
                setErrorMessage('Backend no disponible.');
            }
        }
    };

    const handleSaveApiKey = async () => {
        if (!geminiKey.trim() || geminiKey.includes('***')) return;

        setSaveStatus('saving');
        setErrorMessage(null);

        try {
            const response = await configApi.setAiApiKey(geminiKey.trim());

            if (response.data?.success) {
                setSaveStatus('saved');
                setIsConfigured(true);
                setConnectionStatus('connected');
                localStorage.setItem('gemini_api_key_configured', 'true');

                setTimeout(() => setSaveStatus('idle'), 2000);
                onConfigured?.();
            } else {
                throw new Error(response.data?.error || 'Error desconocido');
            }
        } catch (error: any) {
            console.error('Failed to save Gemini key:', error);
            setSaveStatus('error');
            setErrorMessage(error.response?.data?.error || error.message || 'Error al guardar la API Key');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };

    const handleTestConnection = async () => {
        setConnectionStatus('checking');
        setTestResponse(null);
        setErrorMessage(null);

        try {
            // Probar con un mensaje simple
            const response = await fetch('/api/bot/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Hola, di solo "OK" si funciona' })
            });

            const data = await response.json();

            if (data.success && data.response) {
                setConnectionStatus('connected');
                setTestResponse(data.response.response || 'Conexion exitosa');
            } else {
                setConnectionStatus('error');
                setErrorMessage(data.error || 'No se pudo conectar con Gemini');
            }
        } catch (error: any) {
            setConnectionStatus('error');
            setErrorMessage('Error al probar la conexion: ' + (error.message || 'Error desconocido'));
        }
    };

    const handleCopyExample = () => {
        navigator.clipboard.writeText('AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const renderConnectionBadge = () => {
        switch (connectionStatus) {
            case 'checking':
                return (
                    <span className="flex items-center gap-1 text-xs text-yellow-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Verificando...
                    </span>
                );
            case 'connected':
                return (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Conectado
                    </span>
                );
            case 'error':
                return (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                        <XCircle className="w-3 h-3" />
                        Error
                    </span>
                );
            case 'not_configured':
                return (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                        <AlertCircle className="w-3 h-3" />
                        No configurado
                    </span>
                );
            default:
                return null;
        }
    };

    if (compact) {
        return (
            <div className="space-y-4">
                {/* Status badge */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">Estado de Gemini AI</span>
                    </div>
                    <div className={clsx(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        connectionStatus === 'connected'
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : connectionStatus === 'error'
                                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    )}>
                        {connectionStatus === 'connected' ? 'Conectado' : connectionStatus === 'error' ? 'Error' : 'No configurado'}
                    </div>
                </div>

                {/* API Key Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        API Key
                    </label>
                    <div className="relative">
                        <input
                            type={showGeminiKey ? 'text' : 'password'}
                            value={geminiKey}
                            onChange={(e) => {
                                setGeminiKey(e.target.value);
                                setErrorMessage(null);
                            }}
                            placeholder="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                            className="w-full px-3 py-2 pr-20 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-whatsapp-green bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                                onClick={() => setShowGeminiKey(!showGeminiKey)}
                                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                title={showGeminiKey ? 'Ocultar' : 'Mostrar'}
                            >
                                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error message */}
                {errorMessage && (
                    <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
                )}

                {/* Save button */}
                <button
                    onClick={handleSaveApiKey}
                    disabled={!geminiKey.trim() || geminiKey.includes('***') || saveStatus === 'saving'}
                    className={clsx(
                        "w-full py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2",
                        saveStatus === 'saved'
                            ? "bg-green-500"
                            : saveStatus === 'error'
                                ? "bg-red-500"
                                : "bg-whatsapp-green hover:bg-green-600"
                    )}
                >
                    {saveStatus === 'saving' ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Guardando...
                        </>
                    ) : saveStatus === 'saved' ? (
                        <>
                            <CheckCircle2 className="w-4 h-4" />
                            Guardado
                        </>
                    ) : (
                        <>
                            <Check className="w-4 h-4" />
                            Guardar API Key
                        </>
                    )}
                </button>

                {/* Help link */}
                <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                    <ExternalLink className="w-4 h-4" />
                    Obtener API Key de Google AI Studio
                </a>

                {/* Test button if configured */}
                {isConfigured && (
                    <button
                        onClick={handleTestConnection}
                        disabled={connectionStatus === 'checking'}
                        className="w-full py-2 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <RefreshCw className={clsx("w-4 h-4", connectionStatus === 'checking' && "animate-spin")} />
                        Probar conexion
                    </button>
                )}

                {testResponse && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400">
                        <span className="font-medium">Respuesta:</span> {testResponse}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                    <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-[#e9edef]">Configurar Gemini AI</h3>
                    <p className="text-sm text-[#8696a0]">Conecta tu bot con la inteligencia artificial de Google</p>
                </div>
            </div>

            {/* Status Card */}
            <div className={clsx(
                "p-4 rounded-lg border",
                connectionStatus === 'connected'
                    ? "bg-green-500/10 border-green-500/30"
                    : connectionStatus === 'error'
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-[#182229] border-[#374248]"
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {connectionStatus === 'connected' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : connectionStatus === 'error' ? (
                            <XCircle className="w-5 h-5 text-red-400" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-[#8696a0]" />
                        )}
                        <div>
                            <p className="text-sm font-medium text-[#e9edef]">
                                {connectionStatus === 'connected'
                                    ? 'Gemini conectado correctamente'
                                    : connectionStatus === 'error'
                                        ? 'Error de conexion'
                                        : 'API Key no configurada'}
                            </p>
                            {connectionStatus === 'connected' && (
                                <p className="text-xs text-[#8696a0]">El bot puede usar IA para responder</p>
                            )}
                        </div>
                    </div>
                    {isConfigured && (
                        <button
                            onClick={handleTestConnection}
                            disabled={connectionStatus === 'checking'}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#2a3942] text-[#e9edef] rounded-lg hover:bg-[#374248] disabled:opacity-50"
                        >
                            <RefreshCw className={clsx("w-3 h-3", connectionStatus === 'checking' && "animate-spin")} />
                            Probar
                        </button>
                    )}
                </div>

                {testResponse && (
                    <div className="mt-3 p-2 bg-[#2a3942] rounded text-xs text-[#8696a0]">
                        <span className="text-[#00a884]">Respuesta:</span> {testResponse}
                    </div>
                )}

                {errorMessage && (
                    <p className="mt-2 text-xs text-red-400">{errorMessage}</p>
                )}
            </div>

            {/* Instructions Collapsible */}
            <div className="border border-[#374248] rounded-lg overflow-hidden">
                <button
                    onClick={() => setShowInstructions(!showInstructions)}
                    className="w-full p-4 flex items-center justify-between bg-[#182229] hover:bg-[#1f2c34] transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-[#00a884]" />
                        <span className="text-sm font-medium text-[#e9edef]">Como obtener tu API Key</span>
                    </div>
                    {showInstructions ? (
                        <ChevronUp className="w-5 h-5 text-[#8696a0]" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-[#8696a0]" />
                    )}
                </button>

                {showInstructions && (
                    <div className="p-4 bg-[#111b21] space-y-4">
                        {/* Step 1 */}
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center text-xs font-bold text-white">
                                1
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-[#e9edef] mb-2">
                                    Ve a <strong>Google AI Studio</strong> para crear tu API Key gratuita
                                </p>
                                <a
                                    href="https://aistudio.google.com/app/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2a3942] text-[#00a884] rounded-lg hover:bg-[#374248] transition-colors text-sm"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Abrir Google AI Studio
                                </a>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center text-xs font-bold text-white">
                                2
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-[#e9edef] mb-2">
                                    Inicia sesion con tu cuenta de Google (la misma que usas para Gmail)
                                </p>
                                <p className="text-xs text-[#8696a0]">
                                    Si es tu primera vez, acepta los terminos de servicio
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center text-xs font-bold text-white">
                                3
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-[#e9edef] mb-2">
                                    Haz clic en <strong>"Create API Key"</strong> o <strong>"Get API Key"</strong>
                                </p>
                                <p className="text-xs text-[#8696a0]">
                                    Puedes seleccionar un proyecto existente o crear uno nuevo
                                </p>
                            </div>
                        </div>

                        {/* Step 4 */}
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center text-xs font-bold text-white">
                                4
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-[#e9edef] mb-2">
                                    Copia la API Key generada (empieza con <code className="bg-[#2a3942] px-1 rounded">AIza</code>)
                                </p>
                                <div className="flex items-center gap-2 p-2 bg-[#2a3942] rounded text-xs">
                                    <code className="flex-1 text-[#8696a0] font-mono">AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX</code>
                                    <button
                                        onClick={handleCopyExample}
                                        className="p-1 text-[#8696a0] hover:text-[#e9edef]"
                                        title="Copiar formato de ejemplo"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Step 5 */}
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center text-xs font-bold text-white">
                                5
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-[#e9edef]">
                                    Pega tu API Key en el campo de abajo y haz clic en guardar
                                </p>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <div className="flex gap-2">
                                <Zap className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="text-xs text-blue-200">
                                    <p className="font-medium mb-1">Plan gratuito incluye:</p>
                                    <ul className="list-disc list-inside text-blue-300 space-y-0.5">
                                        <li>60 solicitudes por minuto</li>
                                        <li>1 millon de tokens por minuto</li>
                                        <li>Modelo Gemini 1.5 Flash (rapido y eficiente)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* API Key Input */}
            <div className="space-y-3">
                <label className="flex items-center justify-between">
                    <span className="text-sm text-[#8696a0]">Tu API Key de Gemini</span>
                    {renderConnectionBadge()}
                </label>

                <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8696a0]" />
                    <input
                        type={showGeminiKey ? 'text' : 'password'}
                        value={geminiKey}
                        onChange={(e) => {
                            setGeminiKey(e.target.value);
                            setErrorMessage(null);
                        }}
                        placeholder="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                        className="w-full p-3 pl-10 pr-24 bg-[#2a3942] text-[#e9edef] rounded-lg border border-[#374248] focus:outline-none focus:border-[#00a884] font-mono text-sm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                            onClick={() => setShowGeminiKey(!showGeminiKey)}
                            className="p-2 text-[#8696a0] hover:text-[#e9edef] transition-colors"
                            title={showGeminiKey ? 'Ocultar' : 'Mostrar'}
                        >
                            {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSaveApiKey}
                    disabled={!geminiKey.trim() || geminiKey.includes('***') || saveStatus === 'saving'}
                    className={clsx(
                        "w-full p-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
                        saveStatus === 'saved'
                            ? "bg-green-500 text-white"
                            : saveStatus === 'error'
                                ? "bg-red-500 text-white"
                                : "bg-[#00a884] text-white hover:bg-[#00bf96] disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                >
                    {saveStatus === 'saving' ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Guardando...
                        </>
                    ) : saveStatus === 'saved' ? (
                        <>
                            <CheckCircle2 className="w-5 h-5" />
                            Guardado correctamente
                        </>
                    ) : saveStatus === 'error' ? (
                        <>
                            <XCircle className="w-5 h-5" />
                            Error al guardar
                        </>
                    ) : (
                        <>
                            <Check className="w-5 h-5" />
                            Guardar API Key
                        </>
                    )}
                </button>

                {saveStatus === 'saved' && (
                    <p className="text-center text-xs text-green-400">
                        Tu bot ahora puede usar Gemini AI para responder preguntas
                    </p>
                )}
            </div>

            {/* Features Info */}
            {isConfigured && (
                <div className="p-4 bg-[#182229] rounded-lg border border-[#374248]">
                    <div className="flex items-center gap-2 mb-3">
                        <Bot className="w-5 h-5 text-[#00a884]" />
                        <span className="text-sm font-medium text-[#e9edef]">Funcionalidades habilitadas</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2 text-[#8696a0]">
                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                            Respuestas inteligentes
                        </div>
                        <div className="flex items-center gap-2 text-[#8696a0]">
                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                            Contexto de conversacion
                        </div>
                        <div className="flex items-center gap-2 text-[#8696a0]">
                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                            Fallback automatico
                        </div>
                        <div className="flex items-center gap-2 text-[#8696a0]">
                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                            Aprendizaje continuo
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GeminiConfigPanel;
