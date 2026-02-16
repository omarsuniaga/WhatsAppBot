import { AlertCircle, ShieldAlert } from 'lucide-react';
import { type ContactDiagnosticItem, type IntegrityIssue } from '../types';
import { readableClassName } from '../utils';

interface DiagnosticPanelsProps {
    contactDiagnostics: ContactDiagnosticItem[];
    integrityIssues: IntegrityIssue[];
    highlightDiagnostics: boolean;
    resolvedNotice: string;
    reviewingDiagnosticId: string;
    onNavigateFix: (item: ContactDiagnosticItem) => void;
    onExportIntegrityCSV: () => void;
    onNavigateClass: (issue: IntegrityIssue) => void;
}

export const DiagnosticPanels = ({
    contactDiagnostics, integrityIssues, highlightDiagnostics,
    resolvedNotice, reviewingDiagnosticId,
    onNavigateFix, onExportIntegrityCSV, onNavigateClass
}: DiagnosticPanelsProps) => (
    <div className="space-y-6">
        <div className={`bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-4 shadow-sm transition-all ${highlightDiagnostics ? 'ring-2 ring-indigo-500' : ''}`}>
            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Diagnóstico de Contactos
            </h3>
            {resolvedNotice && (
                <div className="mb-3 p-2 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-700">
                    <span className="font-semibold">Incidencia resuelta:</span> {resolvedNotice}
                </div>
            )}
            <div className="space-y-2 max-h-56 overflow-y-auto">
                {contactDiagnostics.map(item => (
                    <div key={item.id} className={`text-xs border dark:border-gray-700 rounded-lg p-2 ${reviewingDiagnosticId === item.id ? 'bg-indigo-50 ring-1 ring-indigo-400' : 'bg-amber-50/60'}`}>
                        <p className="font-semibold">{item.entityType === 'student' ? 'Alumno' : 'Docente'}: {item.name}</p>
                        <p className="text-amber-700">{item.reason}</p>
                        <button
                            onClick={() => onNavigateFix(item)}
                            className="mt-2 px-2 py-1 rounded bg-indigo-600 text-white text-[11px] font-semibold"
                        > Corregir Datos </button>
                    </div>
                ))}
                {contactDiagnostics.length === 0 && <p className="text-sm text-green-600">No hay incidencias de JID detectadas.</p>}
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-indigo-500" />
                    Auditoría Relacional
                </h3>
                <button onClick={onExportIntegrityCSV} className="text-[11px] px-2 py-1 rounded bg-indigo-600 text-white font-semibold"> Exportar CSV </button>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto">
                {integrityIssues.map(issue => (
                    <div key={issue.id} className={`text-xs border rounded-lg p-2 ${issue.severity === 'high' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                        <p className="font-semibold">{readableClassName(issue.className)}</p>
                        <p className="text-gray-600">{issue.reason}</p>
                        <button onClick={() => onNavigateClass(issue)} className="mt-2 px-2 py-1 rounded bg-indigo-600 text-white text-[11px] font-semibold"> Abrir Clase </button>
                    </div>
                ))}
                {integrityIssues.length === 0 && <p className="text-sm text-green-600">Sin incidencias relacionales detectadas.</p>}
            </div>
        </div>
    </div>
);
