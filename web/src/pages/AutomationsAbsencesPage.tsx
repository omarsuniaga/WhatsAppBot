/**
 * AutomationsAbsencesPage - Generate and review absence notification drafts
 */

import { useState } from 'react';
import { 
    FileText, Send, RefreshCw, AlertTriangle, 
    CheckCircle, XCircle,
    ChevronDown, ChevronUp, Eye
} from 'lucide-react';

interface AbsenceDraft {
    contactId: string;
    contactName: string;
    phone: string;
    studentId: string;
    studentName: string;
    absenceCount: number;
    absenceDates: string[];
    messageText: string;
    reason: string;
    templateId?: string;
}

interface DraftResult {
    success: boolean;
    drafts: AbsenceDraft[];
    summary: {
        studentsAnalyzed: number;
        studentsAboveThreshold: number;
        draftsGenerated: number;
        period: { startDate: string; endDate: string; days: number };
        threshold: number;
    };
    errors: string[];
}

const API_BASE = 'http://localhost:3001/api/admin';

export const AutomationsAbsencesPage = () => {
    const [days, setDays] = useState(7);
    const [threshold, setThreshold] = useState(2);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<DraftResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
    const [expandedDraft, setExpandedDraft] = useState<string | null>(null);
    const [sendResult, setSendResult] = useState<any>(null);

    const getAdminKey = () => localStorage.getItem('ADMIN_API_KEY') || 'dev-admin-key-123';

    const generateDrafts = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        setSendResult(null);

        try {
            const response = await fetch(`${API_BASE}/automations/absences/drafts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-api-key': getAdminKey()
                },
                body: JSON.stringify({ days, threshold })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error generating drafts');
            }

            setResult(data.data);
            // Select all drafts by default
            setSelectedDrafts(new Set(data.data.drafts.map((d: AbsenceDraft) => d.studentId)));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const sendSelectedDrafts = async () => {
        if (!result || selectedDrafts.size === 0) return;

        const draftsToSend = result.drafts.filter(d => selectedDrafts.has(d.studentId));
        
        if (!confirm(`¿Enviar ${draftsToSend.length} mensaje(s) a los representantes?`)) {
            return;
        }

        setSending(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/whatsapp/send-drafts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-api-key': getAdminKey()
                },
                body: JSON.stringify({
                    drafts: draftsToSend,
                    confirmedBy: 'admin-dashboard'
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error sending drafts');
            }

            setSendResult(data.data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    };

    const toggleDraft = (studentId: string) => {
        const newSelected = new Set(selectedDrafts);
        if (newSelected.has(studentId)) {
            newSelected.delete(studentId);
        } else {
            newSelected.add(studentId);
        }
        setSelectedDrafts(newSelected);
    };

    const toggleAll = () => {
        if (!result) return;
        if (selectedDrafts.size === result.drafts.length) {
            setSelectedDrafts(new Set());
        } else {
            setSelectedDrafts(new Set(result.drafts.map(d => d.studentId)));
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-6 h-6 text-yellow-500" />
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                            Borradores de Ausencias
                        </h1>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">
                        Genera borradores de notificación para representantes de estudiantes con ausencias.
                        Revisa y confirma antes de enviar.
                    </p>
                </div>

                {/* Configuration */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 mb-6">
                    <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
                        Configuración
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Período (días)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="30"
                                value={days}
                                onChange={(e) => setDays(parseInt(e.target.value) || 7)}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Umbral de ausencias
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={threshold}
                                onChange={(e) => setThreshold(parseInt(e.target.value) || 2)}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={generateDrafts}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                {loading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <FileText className="w-4 h-4" />
                                )}
                                Generar Borradores
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                            <XCircle className="w-5 h-5" />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                {/* Send Result */}
                {sendResult && (
                    <div className={`border rounded-lg p-4 mb-6 ${
                        sendResult.failCount === 0 
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    }`}>
                        <div className="flex items-center gap-2 mb-2">
                            {sendResult.failCount === 0 ? (
                                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                            )}
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                                Enviados: {sendResult.successCount} / {sendResult.total}
                            </span>
                        </div>
                        {sendResult.failCount > 0 && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {sendResult.failCount} mensaje(s) fallaron. Revisa el log de eventos.
                            </p>
                        )}
                    </div>
                )}

                {/* Results */}
                {result && (
                    <>
                        {/* Summary */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-6">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                        {result.summary.studentsAnalyzed}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Estudiantes analizados</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                        {result.summary.studentsAboveThreshold}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Sobre umbral</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {result.summary.draftsGenerated}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Borradores</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                        {result.summary.period.startDate}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">al {result.summary.period.endDate}</p>
                                </div>
                            </div>
                        </div>

                        {/* Drafts List */}
                        {result.drafts.length > 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
                                {/* Header */}
                                <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedDrafts.size === result.drafts.length}
                                            onChange={toggleAll}
                                            className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                                        />
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {selectedDrafts.size} seleccionado(s)
                                        </span>
                                    </div>
                                    <button
                                        onClick={sendSelectedDrafts}
                                        disabled={sending || selectedDrafts.size === 0}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                    >
                                        {sending ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                        Enviar Seleccionados
                                    </button>
                                </div>

                                {/* Drafts */}
                                <div className="divide-y dark:divide-gray-700">
                                    {result.drafts.map((draft) => (
                                        <div 
                                            key={draft.studentId}
                                            className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                        >
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDrafts.has(draft.studentId)}
                                                    onChange={() => toggleDraft(draft.studentId)}
                                                    className="mt-1 w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-800 dark:text-gray-200">
                                                                {draft.studentName}
                                                            </span>
                                                            <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                                                {draft.absenceCount} ausencias
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => setExpandedDraft(
                                                                expandedDraft === draft.studentId ? null : draft.studentId
                                                            )}
                                                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                                        >
                                                            {expandedDraft === draft.studentId ? (
                                                                <ChevronUp className="w-4 h-4 text-gray-500" />
                                                            ) : (
                                                                <ChevronDown className="w-4 h-4 text-gray-500" />
                                                            )}
                                                        </button>
                                                    </div>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        Contacto: {draft.contactName} • {draft.phone}
                                                    </p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                        Fechas: {draft.absenceDates.join(', ')}
                                                    </p>

                                                    {/* Expanded Message Preview */}
                                                    {expandedDraft === draft.studentId && (
                                                        <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                                            <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 dark:text-gray-400">
                                                                <Eye className="w-3 h-3" />
                                                                Vista previa del mensaje
                                                            </div>
                                                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                                                {draft.messageText}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-8 text-center">
                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">
                                    ¡Todo en orden!
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    No hay estudiantes con {threshold}+ ausencias en los últimos {days} días.
                                </p>
                            </div>
                        )}

                        {/* Errors */}
                        {result.errors.length > 0 && (
                            <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                <h4 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">
                                    Advertencias
                                </h4>
                                <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                                    {result.errors.map((err, i) => (
                                        <li key={i}>• {err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}

                {/* Help Text */}
                {!result && !loading && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                            ¿Cómo funciona?
                        </h4>
                        <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                            <li>Configura el período y umbral de ausencias</li>
                            <li>Haz clic en "Generar Borradores" para ver qué notificaciones se enviarían</li>
                            <li>Revisa cada mensaje y ajusta la selección si es necesario</li>
                            <li>Confirma y envía los mensajes a los representantes</li>
                        </ol>
                    </div>
                )}
            </div>
        </div>
    );
};
