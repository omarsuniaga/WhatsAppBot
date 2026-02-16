import { ShieldAlert, HelpCircle } from 'lucide-react';
import { type FilterPeriod } from '../types';

interface AttendanceHeaderProps {
    period: FilterPeriod;
    setPeriod: (p: FilterPeriod) => void;
    onShowHelp: () => void;
}

export const AttendanceHeader = ({ period, setPeriod, onShowHelp }: AttendanceHeaderProps) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-indigo-500" />
                Control de Asistencias
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
                Supervisión de cumplimiento y seguimiento de ausencias
            </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <button
                onClick={onShowHelp}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 transition-colors"
            >
                <HelpCircle className="w-4 h-4" />
                Ayuda
            </button>

            <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl border dark:border-gray-700 shadow-sm">
                {(['today', 'week', 'month', 'custom'] as const).map((p) => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'}`}
                    >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                ))}
            </div>
        </div>
    </div>
);
