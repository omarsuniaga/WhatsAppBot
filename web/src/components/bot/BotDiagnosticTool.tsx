import { useState } from 'react';
import { Play, AlertCircle, CheckCircle2, Bot, MessageSquare, Zap, Loader2, X, Brain, Check } from 'lucide-react';
import { triggerApi } from '../../api/client';
import { clsx } from 'clsx';

export const BotDiagnosticTool = ({ onClose }: { onClose?: () => void }) => {
    const [testMessage, setTestMessage] = useState('');
    const [diagnostics, setDiagnostics] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRunTest = async () => {
        if (!testMessage.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);
        try {
            const response = await triggerApi.testMessage(testMessage);
            if (response.data?.success) {
                setDiagnostics(response.data.data);
            } else {
                setError(response.data?.error || 'Failed to run test');
            }
        } catch (error: any) {
            console.error('Diagnostic error:', error);
            setError(error.response?.data?.error || error.message || 'Error de conexión');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-[#182229] border border-gray-200 dark:border-[#374248] rounded-xl overflow-hidden shadow-xl animate-fade-in">
            {/* Header */}
            <div className="p-4 bg-gray-50 dark:bg-[#202c33] border-b border-gray-200 dark:border-[#374248] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    <h3 className="font-semibold text-gray-800 dark:text-[#e9edef]">Diagnóstico del Bot</h3>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="p-6 space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-[#8696a0]">
                        Mensaje de Prueba
                    </label>
                    <div className="relative">
                        <textarea
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                            placeholder="Escribe un mensaje para ver qué triggers activaría..."
                            className="w-full h-24 p-4 pr-12 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg focus:ring-2 focus:ring-[#00a884] focus:border-transparent text-gray-800 dark:text-[#e9edef] resize-none"
                        />
                        <button
                            onClick={handleRunTest}
                            disabled={!testMessage.trim() || isLoading}
                            className="absolute bottom-4 right-4 p-2 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                            title="Probar ahora"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                )}

                {diagnostics && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Global Status */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#202c33] rounded-lg border border-gray-200 dark:border-[#374248]">
                            <span className="text-sm text-gray-600 dark:text-[#8696a0]">Estado del Listener:</span>
                            <div className="flex items-center gap-2">
                                <span className={clsx(
                                    "px-2 py-0.5 rounded-full text-xs font-bold",
                                    diagnostics.listenerEnabled
                                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                )}>
                                    {diagnostics.listenerEnabled ? 'ENCENDIDO' : 'APAGADO'}
                                </span>
                            </div>
                        </div>

                        {/* Triggers found */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-[#e9edef] flex items-center gap-2">
                                <Bot className="w-4 h-4 text-[#00a884]" />
                                Triggers Detectados ({diagnostics.triggers?.length || 0})
                            </h4>

                            {diagnostics.triggers && diagnostics.triggers.length > 0 ? (
                                <div className="space-y-2">
                                    {diagnostics.triggers.map((t: any, idx: number) => (
                                        <div key={idx} className="p-3 bg-[#111b21] border border-[#374248] rounded-lg">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium text-[#e9edef]">"{t.keyword}"</span>
                                                <span className="text-[10px] uppercase font-bold text-[#00a884] bg-[#00a884]/10 px-1.5 rounded">
                                                    {t.matchType}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-[#8696a0]">
                                                <span>Importancia: {t.priority}</span>
                                                <span>•</span>
                                                <span>Categoría: {t.category || 'Sin categoría'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 border-2 border-dashed border-gray-200 dark:border-[#374248] rounded-lg text-center">
                                    <MessageSquare className="w-8 h-8 text-gray-300 dark:text-[#374248] mx-auto mb-2" />
                                    <p className="text-sm text-gray-500 dark:text-[#8696a0]">
                                        Ningún trigger activado por este mensaje.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Analysis Result */}
                        <div className={clsx(
                            "p-4 rounded-lg border flex items-start gap-3",
                            diagnostics.wouldActivate
                                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                        )}>
                            {diagnostics.wouldActivate ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                            )}
                            <div>
                                <p className={clsx(
                                    "font-medium mb-1",
                                    diagnostics.wouldActivate ? "text-green-800 dark:text-green-400" : "text-yellow-800 dark:text-yellow-400"
                                )}>
                                    {diagnostics.wouldActivate
                                        ? "El bot RESPONDERÍA a este mensaje."
                                        : "El bot NO RESPONDERÍA por triggers."}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-[#8696a0] leading-relaxed">
                                    {diagnostics.wouldActivate
                                        ? "Se detectaron palabras clave válidas y el modo automático está habilitado."
                                        : (diagnostics.requireTrigger
                                            ? "No se encontraron triggers y se requiere uno para responder."
                                            : "El listener está deshabilitado o no se cumplen las condiciones.")}
                                </p>
                            </div>
                        </div>

                        {/* AI Explanation (Phase 4) */}
                        {diagnostics.aiAnalysis && (
                            <div className="space-y-2 p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 rounded-lg animate-fade-in-up">
                                <h4 className="text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2 uppercase tracking-wide">
                                    <Brain className="w-3 h-3" />
                                    Razonamiento de IA (Flash)
                                </h4>
                                <div className="space-y-3 mt-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500 dark:text-[#8696a0]">Confianza semántica:</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-1.5 bg-gray-200 dark:bg-[#374248] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-purple-500 rounded-full"
                                                    style={{ width: `${diagnostics.aiAnalysis.confidence * 100}%` }}
                                                />
                                            </div>
                                            <span className="font-mono text-purple-600 dark:text-purple-400">
                                                {(diagnostics.aiAnalysis.confidence * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>

                                    {diagnostics.aiAnalysis.shouldRespond ? (
                                        <div className="bg-white dark:bg-[#111b21] p-3 rounded border border-purple-200 dark:border-purple-800/50">
                                            <p className="text-[11px] text-[#8696a0] mb-1 font-semibold uppercase">Respuesta Generada:</p>
                                            <p className="text-sm text-gray-700 dark:text-[#e9edef] italic leading-snug">
                                                "{diagnostics.aiAnalysis.response}"
                                            </p>
                                            {diagnostics.aiAnalysis.faqId && (
                                                <div className="mt-2 text-[10px] text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                                    <Check className="w-3 h-3" />
                                                    Vinculado a FAQ: {diagnostics.aiAnalysis.faqId}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 p-2 rounded">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                            <p>
                                                {diagnostics.aiAnalysis.escalated
                                                    ? "La IA recomienda ESCALAR a un agente humano por baja confianza o complejidad."
                                                    : "La IA determinó que no debe responder a este mensaje."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
