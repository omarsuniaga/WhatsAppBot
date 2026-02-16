import { AlertCircle, Bell, RefreshCw } from 'lucide-react';
import { type PendingClass } from '../types';
import { readableClassName } from '../utils';

interface PendingReportsProps {
    pendingList: PendingClass[];
    actionLoading: string | null;
    onRemindTeacher: (pending: PendingClass) => void;
    connectionStatus: string;
}

export const PendingReports = ({ pendingList, actionLoading, onRemindTeacher, connectionStatus: _connectionStatus }: PendingReportsProps) => {
    if (pendingList.length === 0) return null;

    return (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
            <h4 className="text-amber-800 dark:text-amber-400 font-bold flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4" />
                Reportes Pendientes de Hoy ({pendingList.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingList.map((c, index) => (
                    <div
                        key={`pending-${c.id}-${index}`}
                        onClick={() => actionLoading !== c.id && onRemindTeacher(c)}
                        className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-3 rounded-xl flex items-center justify-between shadow-sm cursor-pointer hover:border-indigo-300 transition-colors"
                    >
                        <div>
                            <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{readableClassName(c.name)}</p>
                            <p className="text-xs text-gray-500">{c.teacher}</p>
                        </div>
                        <button
                            className={`p-2 rounded-lg transition-all ${actionLoading === c.id ? 'bg-gray-100 animate-pulse' : 'text-indigo-500 hover:bg-indigo-50'}`}
                            disabled={actionLoading === c.id}
                        >
                            {actionLoading === c.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
