/**
 * AlertResponseModal - Modal to respond to an alert and optionally learn from it
 */
import { useState } from 'react';
import { clsx } from 'clsx';
import {
    X,
    Send,
    Brain,
    MessageSquare,
    Lightbulb,
    AlertCircle,
    Loader2,
    Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PendingAlert } from './AlertPanel';

interface AlertResponseModalProps {
    alert: PendingAlert;
    onClose: () => void;
    onRespond: (alertId: string, response: string, shouldLearn: boolean) => Promise<void>;
    onDismiss: (alertId: string, reason?: string) => Promise<void>;
}

const suggestedResponses = [
    "Gracias por tu consulta. Permíteme verificar esa información y te respondo a la brevedad.",
    "Entiendo tu consulta. En este momento no tenemos esa información disponible, pero la conseguiré para ti.",
    "Gracias por contactarnos. Un miembro de nuestro equipo se pondrá en contacto contigo pronto.",
];

export const AlertResponseModal = ({
    alert,
    onClose,
    onRespond,
    onDismiss
}: AlertResponseModalProps) => {
    const [response, setResponse] = useState('');
    const [shouldLearn, setShouldLearn] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dismissReason, setDismissReason] = useState('');
    const [showDismissInput, setShowDismissInput] = useState(false);

    const handleSubmit = async () => {
        if (!response.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onRespond(alert.id, response.trim(), shouldLearn);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDismiss = async () => {
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onDismiss(alert.id, dismissReason || undefined);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSubmit();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/70"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#111b21] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-[#202c33] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-medium">
                            {alert.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-[#e9edef] font-medium">
                                Responder a {alert.customerName}
                            </h3>
                            <span className="text-xs text-[#8696a0]">
                                +{alert.customerPhone}
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
                    {/* Conversation context */}
                    {alert.conversationContext.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-[#8696a0] mb-3 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Contexto de la conversación
                            </h4>
                            <div className="bg-[#0b141a] rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                                {alert.conversationContext.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={clsx(
                                            "text-sm p-2 rounded",
                                            msg.role === 'customer'
                                                ? "bg-[#202c33] text-[#e9edef]"
                                                : "bg-[#005c4b] text-white ml-4"
                                        )}
                                    >
                                        <span className="text-xs text-[#8696a0] block mb-1">
                                            {msg.role === 'customer' ? 'Cliente' : 'Bot'}
                                        </span>
                                        {msg.message}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Current message */}
                    <div>
                        <h4 className="text-sm font-medium text-[#8696a0] mb-3 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-[#00a884]" />
                            Mensaje actual
                        </h4>
                        <div className="bg-[#00a884]/10 border border-[#00a884]/30 rounded-lg p-4">
                            <p className="text-[#e9edef]">"{alert.originalMessage}"</p>
                            <span className="text-xs text-[#8696a0] mt-2 block">
                                {format(new Date(alert.createdAt), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                            </span>
                        </div>
                    </div>

                    {/* Analysis */}
                    <div>
                        <h4 className="text-sm font-medium text-[#8696a0] mb-3 flex items-center gap-2">
                            <Brain className="w-4 h-4" />
                            Análisis
                        </h4>
                        <div className="bg-[#202c33] rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[#8696a0] text-sm">Intención:</span>
                                <span className="px-2 py-0.5 bg-[#2a3942] text-[#e9edef] text-sm rounded">
                                    {alert.geminiAnalysis.intent.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <div>
                                <span className="text-[#8696a0] text-sm">Razón de escalación:</span>
                                <p className="text-[#e9edef] text-sm mt-1">
                                    {alert.geminiAnalysis.reason}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Suggested responses */}
                    <div>
                        <h4 className="text-sm font-medium text-[#8696a0] mb-3 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" />
                            Respuestas sugeridas
                        </h4>
                        <div className="space-y-2">
                            {suggestedResponses.map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => setResponse(suggestion)}
                                    className="w-full text-left p-3 bg-[#202c33] hover:bg-[#2a3942] rounded-lg text-sm text-[#e9edef] transition-colors"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Response input */}
                    <div>
                        <h4 className="text-sm font-medium text-[#8696a0] mb-3">
                            Tu respuesta
                        </h4>
                        <textarea
                            value={response}
                            onChange={(e) => setResponse(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe tu respuesta al cliente..."
                            rows={4}
                            className="w-full px-4 py-3 bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                        />
                        <p className="text-xs text-[#8696a0] mt-1">
                            Presiona Ctrl+Enter para enviar
                        </p>
                    </div>

                    {/* Learning toggle */}
                    <label className="flex items-center gap-3 p-4 bg-[#202c33] rounded-lg cursor-pointer">
                        <input
                            type="checkbox"
                            checked={shouldLearn}
                            onChange={(e) => setShouldLearn(e.target.checked)}
                            className="w-5 h-5 rounded border-[#8696a0] text-[#00a884] focus:ring-[#00a884]"
                        />
                        <div>
                            <span className="text-[#e9edef] font-medium flex items-center gap-2">
                                <Brain className="w-4 h-4 text-[#00a884]" />
                                Agregar a base de conocimiento
                            </span>
                            <p className="text-xs text-[#8696a0] mt-0.5">
                                El bot aprenderá de esta respuesta para consultas similares
                            </p>
                        </div>
                    </label>

                    {/* Dismiss section */}
                    {!showDismissInput ? (
                        <button
                            onClick={() => setShowDismissInput(true)}
                            className="text-sm text-[#8696a0] hover:text-red-400 transition-colors"
                        >
                            Descartar sin responder
                        </button>
                    ) : (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-red-400 mb-2">
                                Descartar alerta
                            </h4>
                            <input
                                type="text"
                                value={dismissReason}
                                onChange={(e) => setDismissReason(e.target.value)}
                                placeholder="Razón (opcional)"
                                className="w-full px-3 py-2 bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={() => setShowDismissInput(false)}
                                    className="px-3 py-1.5 text-sm text-[#8696a0] hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                    Descartar
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-[#202c33] flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-[#8696a0] hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!response.trim() || isSubmitting}
                        className="flex items-center gap-2 px-6 py-2 bg-[#00a884] hover:bg-[#06cf9c] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                        Enviar respuesta
                    </button>
                </div>
            </div>
        </div>
    );
};
