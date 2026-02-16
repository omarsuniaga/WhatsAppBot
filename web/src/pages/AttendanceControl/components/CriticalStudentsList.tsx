import { Bell, MessageSquare, RefreshCw, CheckCircle, TrendingUp, Download, ChevronRight } from 'lucide-react';
import { type CriticalStudent } from '../types';
import { type ReactNode } from 'react';

interface CriticalStudentsListProps {
    students: CriticalStudent[];
    actionLoading: string | null;
    onAlertParent: (student: CriticalStudent) => void;
    onExportCSV: () => void;
    onExportPdf: () => void;
}

const ActionButton = ({ label, icon, onClick }: { label: string, icon: ReactNode, onClick: () => void }) => (
    <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-3 rounded-xl border dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all font-medium text-gray-700 dark:text-gray-300 text-sm"
    >
        <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500">
                {icon}
            </div>
            {label}
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
    </button>
);

export const CriticalStudentsList = ({ students, actionLoading, onAlertParent, onExportCSV, onExportPdf }: CriticalStudentsListProps) => (
    <div className="lg:col-span-1 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="p-4 border-b dark:border-gray-700 bg-red-50/50 dark:bg-red-900/10 flex items-center justify-between">
                <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Alumnos en Riesgo
                </h3>
                <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 text-xs font-bold px-2 py-1 rounded-full">
                    {students.length} críticos
                </span>
            </div>
            <div className="p-0 max-h-[400px] overflow-y-auto">
                {students.length > 0 ? (
                    <div className="divide-y dark:divide-gray-700">
                        {students.map((s, index) => (
                            <div key={`critical-${s.id}-${index}`} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">{s.name}</p>
                                    <p className="text-xs text-red-500 font-medium">{s.absences} faltas en el periodo</p>
                                </div>
                                <button
                                    className={`p-2 rounded-lg transition-all ${actionLoading === s.id
                                        ? 'bg-gray-100 animate-pulse'
                                        : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200'
                                        }`}
                                    onClick={() => onAlertParent(s)}
                                    disabled={actionLoading === s.id}
                                >
                                    {actionLoading === s.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-20 text-green-500" />
                        <p className="text-sm">No hay alumnos críticos detectados</p>
                    </div>
                )}
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Acciones Rápidas
            </h3>
            <div className="space-y-3">
                <ActionButton
                    label="Exportar Reporte Excel"
                    icon={<Download className="w-4 h-4" />}
                    onClick={onExportCSV}
                />
                <ActionButton
                    label="Exportar Plantilla PDF"
                    icon={<Download className="w-4 h-4 text-red-500" />}
                    onClick={onExportPdf}
                />
            </div>
        </div>

    </div>
);
