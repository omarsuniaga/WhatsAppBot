/**
 * AlertCard - Individual alert card in the alert list
 */
import { clsx } from 'clsx';
import { 
    AlertCircle,
    AlertTriangle,
    Info,
    Clock,
    ChevronRight,
    CheckCircle,
    XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PendingAlert } from './AlertPanel';

interface AlertCardProps {
    alert: PendingAlert;
    onClick: () => void;
}

const PriorityIcon = ({ priority }: { priority: PendingAlert['priority'] }) => {
    switch (priority) {
        case 'high':
            return <AlertCircle className="w-4 h-4 text-red-500" />;
        case 'medium':
            return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
        default:
            return <Info className="w-4 h-4 text-blue-400" />;
    }
};

const StatusBadge = ({ status }: { status: PendingAlert['status'] }) => {
    switch (status) {
        case 'answered':
            return (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                    <CheckCircle className="w-3 h-3" />
                    Respondido
                </span>
            );
        case 'dismissed':
            return (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full">
                    <XCircle className="w-3 h-3" />
                    Descartado
                </span>
            );
        default:
            return (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-[#00a884]/20 text-[#00a884] text-xs rounded-full">
                    <Clock className="w-3 h-3" />
                    Pendiente
                </span>
            );
    }
};

export const AlertCard = ({ alert, onClick }: AlertCardProps) => {
    const timeAgo = formatDistanceToNow(new Date(alert.createdAt), {
        addSuffix: true,
        locale: es
    });

    const isPending = alert.status === 'pending';

    return (
        <div
            onClick={onClick}
            className={clsx(
                "p-4 cursor-pointer transition-colors",
                isPending 
                    ? "hover:bg-[#202c33] bg-[#111b21]" 
                    : "hover:bg-[#1a2328] bg-[#0b141a] opacity-75"
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-medium">
                        {alert.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[#e9edef] font-medium">
                                {alert.customerName}
                            </span>
                            <PriorityIcon priority={alert.priority} />
                        </div>
                        <span className="text-xs text-[#8696a0]">
                            +{alert.customerPhone}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-[#8696a0]">{timeAgo}</span>
                    <StatusBadge status={alert.status} />
                </div>
            </div>

            {/* Message */}
            <div className="bg-[#202c33] rounded-lg p-3 mb-2">
                <p className="text-[#e9edef] text-sm line-clamp-2">
                    "{alert.originalMessage}"
                </p>
            </div>

            {/* Analysis */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#2a3942] text-[#8696a0] text-xs rounded">
                        {alert.geminiAnalysis.intent.replace(/_/g, ' ')}
                    </span>
                    {alert.geminiAnalysis.confidence > 0 && (
                        <span className="text-xs text-[#8696a0]">
                            {Math.round(alert.geminiAnalysis.confidence * 100)}% conf.
                        </span>
                    )}
                </div>
                {isPending && (
                    <ChevronRight className="w-5 h-5 text-[#8696a0]" />
                )}
            </div>

            {/* Suggested topics */}
            {alert.geminiAnalysis.suggestedTopics.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {alert.geminiAnalysis.suggestedTopics.slice(0, 3).map((topic, i) => (
                        <span
                            key={i}
                            className="px-2 py-0.5 bg-[#00a884]/10 text-[#00a884] text-xs rounded"
                        >
                            {topic.length > 25 ? topic.slice(0, 25) + '...' : topic}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};
