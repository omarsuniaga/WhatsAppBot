import { MessageSquare, RefreshCw } from 'lucide-react';
import { type AttendanceMessageAction, type AttendanceMessageTemplate, type AttendanceTemplateAuditEntry } from '../types';

interface TemplateEditorProps {
    templateEditorAction: AttendanceMessageAction;
    setTemplateEditorAction: (action: AttendanceMessageAction) => void;
    templateDraft: string;
    setTemplateDraft: (draft: string) => void;
    messageTemplates: Record<string, AttendanceMessageTemplate>;
    templatesLoading: boolean;
    templateSaving: boolean;
    templateResetting: boolean;
    templateHistory: AttendanceTemplateAuditEntry[];
    historyLoading: boolean;
    onSave: () => void;
    onReset: () => void;
}

export const TemplateEditor = ({
    templateEditorAction, setTemplateEditorAction, templateDraft, setTemplateDraft,
    messageTemplates, templatesLoading, templateSaving, templateResetting,
    templateHistory, historyLoading, onSave, onReset
}: TemplateEditorProps) => {
    const selectedTemplate = messageTemplates[templateEditorAction];
    const requiredVariables = selectedTemplate?.variables || [];
    const foundVariables = Array.from(new Set(Array.from(templateDraft.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map(match => match[1])));
    const missingVariables = requiredVariables.filter(v => !foundVariables.includes(v));

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    Plantillas WhatsApp
                </h3>
                {templatesLoading && <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                    onClick={() => setTemplateEditorAction('teacher_reminder')}
                    className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${templateEditorAction === 'teacher_reminder' ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
                > Docente </button>
                <button
                    onClick={() => setTemplateEditorAction('parent_absence_alert')}
                    className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${templateEditorAction === 'parent_absence_alert' ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
                > Representante </button>
            </div>
            <textarea
                value={templateDraft}
                onChange={(e) => setTemplateDraft(e.target.value)}
                rows={6}
                className="w-full rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-900/30 p-2 text-xs text-gray-700 dark:text-gray-200 resize-y"
                placeholder="Escribe la plantilla usando {{variables}}"
            />
            <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                Variables: {requiredVariables.map(v => `{{${v}}}`).join(', ') || 'N/A'}
            </div>
            {missingVariables.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-700">
                    Faltan variables obligatorias: {missingVariables.map(v => `{{${v}}}`).join(', ')}
                </div>
            )}
            <button
                onClick={onSave}
                disabled={templateSaving || templatesLoading || missingVariables.length > 0}
                className="mt-3 w-full px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-200"
            > {templateSaving ? 'Guardando...' : 'Guardar Plantilla'} </button>
            <button
                onClick={onReset}
                disabled={templateResetting || templatesLoading}
                className="mt-2 w-full px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200"
            > {templateResetting ? 'Restaurando...' : 'Restaurar por Defecto'} </button>
            <div className="mt-3 border-t dark:border-gray-700 pt-3">
                <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-gray-500">Auditoría de cambios</p>
                    {historyLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
                </div>
                <div className="mt-2 max-h-28 overflow-y-auto space-y-1">
                    {(Array.isArray(templateHistory) ? templateHistory : []).map(item => (
                        <div key={item.id} className="text-[11px] rounded border dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-2">
                            <p className="font-semibold">{item.source === 'reset' ? 'Restaurada' : 'Actualizada'} por {item.updatedBy}</p>
                            <p className="text-gray-500">{new Date(item.updatedAt).toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
