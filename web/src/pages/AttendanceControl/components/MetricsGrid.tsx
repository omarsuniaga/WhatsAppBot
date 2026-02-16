import { type ReactNode } from 'react';
import { ClipboardCheck, XCircle, Clock, AlertCircle } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: ReactNode;
    trend: string;
    color: 'green' | 'red' | 'amber' | 'indigo';
    highlight?: boolean;
}

const MetricCard = ({ title, value, icon, trend, color, highlight = false }: MetricCardProps) => {
    const colors: Record<string, string> = {
        green: 'bg-green-500',
        red: 'bg-red-500',
        amber: 'bg-amber-500',
        indigo: 'bg-indigo-500'
    };

    return (
        <div className={`bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 shadow-sm transition-all hover:shadow-md ${highlight ? 'ring-2 ring-indigo-500' : ''}`}>
            <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-xl bg-opacity-20 ${colors[color]}`}>
                    {icon}
                </div>
                <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</span>
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">{title}</p>
            <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${colors[color]}`} />
                <span className="text-xs font-medium text-gray-400">{trend}</span>
            </div>
        </div>
    );
};

interface MetricsGridProps {
    stats: {
        rate: number;
        absences: number;
        late: number;
        justified: number;
        pendingReports: number;
    };
}

export const MetricsGrid = ({ stats }: MetricsGridProps) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
            title="Tasa de Asistencia"
            value={`${stats.rate}%`}
            icon={<ClipboardCheck className="w-5 h-5 text-green-500" />}
            trend={stats.rate > 90 ? 'Excelente' : 'Requiere atención'}
            color="green"
        />
        <MetricCard
            title="Inasistencias"
            value={stats.absences}
            icon={<XCircle className="w-5 h-5 text-red-500" />}
            trend={`${stats.justified} justificadas`}
            color="red"
        />
        <MetricCard
            title="Tardanzas"
            value={stats.late}
            icon={<Clock className="w-5 h-5 text-amber-500" />}
            trend="Meta: < 5%"
            color="amber"
        />
        <MetricCard
            title="Reportes Pendientes"
            value={stats.pendingReports}
            icon={<AlertCircle className="w-5 h-5 text-indigo-500" />}
            trend="Clases hoy"
            color="indigo"
            highlight={stats.pendingReports > 0}
        />
    </div>
);
