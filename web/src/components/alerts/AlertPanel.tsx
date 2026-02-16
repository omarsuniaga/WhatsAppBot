/**
 * AlertPanel - Sidebar panel showing pending alerts for bot escalations
 */
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import {
    Bell,
    X,
    Loader2
} from 'lucide-react';
import { alertApi } from '../../api/client';
import { AlertCard } from './AlertCard';
import { AlertResponseModal } from './AlertResponseModal';

export interface PendingAlert {
    id: string;
    chatJid: string;
    customerName: string;
    customerPhone: string;
    originalMessage: string;
    conversationContext: Array<{
        role: 'customer' | 'bot';
        message: string;
        timestamp: string;
    }>;
    geminiAnalysis: {
        intent: string;
        suggestedTopics: string[];
        confidence: number;
        reason: string;
    };
    status: 'pending' | 'answered' | 'dismissed';
    priority: 'low' | 'medium' | 'high';
    shouldLearn: boolean;
    createdAt: string;
    expiresAt: string;
    aiDraftResponse?: string;
}

interface AlertRespondOptions {
    deliveryMode?: 'now' | 'scheduled' | 'manual';
    scheduledFor?: string;
}

interface AlertPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onAlertCountChange?: (count: number) => void;
}

export const AlertPanel = ({ isOpen, onClose, onAlertCountChange }: AlertPanelProps) => {
    const [alerts, setAlerts] = useState<PendingAlert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAlert, setSelectedAlert] = useState<PendingAlert | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending'>('pending');

    const [showFrequent, setShowFrequent] = useState(false);
    const [frequentQuestions, setFrequentQuestions] = useState<any[]>([]);
    const [isLoadingFrequent, setIsLoadingFrequent] = useState(false);

    // Fetch alerts
    const fetchAlerts = async () => {
        try {
            setIsLoading(true);
            const response = await alertApi.getAlerts(filter);
            if (response.data.success) {
                setAlerts(response.data.data || []);
                const pendingCount = response.data.data?.filter(
                    (a: PendingAlert) => a.status === 'pending'
                ).length || 0;
                onAlertCountChange?.(pendingCount);
            }
        } catch (error) {
            console.error('Error fetching alerts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch frequent questions
    const fetchFrequentQuestions = async () => {
        try {
            setIsLoadingFrequent(true);
            const response = await alertApi.getFrequentUnanswered();
            if (response.data.success) {
                setFrequentQuestions(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching frequent questions:', error);
        } finally {
            setIsLoadingFrequent(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchAlerts();
            if (showFrequent) {
                fetchFrequentQuestions();
            }
        }
    }, [isOpen, filter, showFrequent]);

    // Listen for WebSocket events
    useEffect(() => {
        const handleNewAlert = (alert: PendingAlert) => {
            setAlerts(prev => {
                const newAlerts = [alert, ...prev];
                const pendingCount = newAlerts.filter(a => a.status === 'pending').length;
                onAlertCountChange?.(pendingCount);
                return newAlerts;
            });
            if (showFrequent) fetchFrequentQuestions();
            // Play notification sound
            playNotificationSound();
        };

        const handleAlertResponded = (data: { alertId: string }) => {
            setAlerts(prev => prev.map(a =>
                a.id === data.alertId ? { ...a, status: 'answered' as const } : a
            ));
            fetchAlerts(); // Refresh to get updated count
            if (showFrequent) fetchFrequentQuestions();
        };

        const handleAlertDismissed = (data: { alertId: string }) => {
            setAlerts(prev => prev.map(a =>
                a.id === data.alertId ? { ...a, status: 'dismissed' as const } : a
            ));
            fetchAlerts();
            if (showFrequent) fetchFrequentQuestions();
        };

        // Subscribe to socket events (if available)
        const socket = (window as any).socket;
        if (socket) {
            socket.on('alert:new', handleNewAlert);
            socket.on('alert:responded', handleAlertResponded);
            socket.on('alert:dismissed', handleAlertDismissed);

            return () => {
                socket.off('alert:new', handleNewAlert);
                socket.off('alert:responded', handleAlertResponded);
                socket.off('alert:dismissed', handleAlertDismissed);
            };
        }
    }, [onAlertCountChange, showFrequent]);

    const playNotificationSound = () => {
        try {
            const audio = new Audio('/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => { });
        } catch (e) {
            // Ignore audio errors
        }
    };

    const handleRespond = async (
        alertId: string,
        response: string,
        shouldLearn: boolean,
        options?: AlertRespondOptions
    ) => {
        try {
            await alertApi.respondToAlert(alertId, response, shouldLearn, options);
            setSelectedAlert(null);
            fetchAlerts();
            if (showFrequent) fetchFrequentQuestions();
        } catch (error) {
            console.error('Error responding to alert:', error);
        }
    };

    const handleDismiss = async (alertId: string, reason?: string) => {
        try {
            await alertApi.dismissAlert(alertId, reason);
            setSelectedAlert(null);
            fetchAlerts();
            if (showFrequent) fetchFrequentQuestions();
        } catch (error) {
            console.error('Error dismissing alert:', error);
        }
    };

    const handleExport = () => {
        const url = alertApi.getExportUrl(filter);
        window.open(url, '_blank');
    };

    const pendingAlerts = alerts.filter(a => a.status === 'pending');
    const displayAlerts = filter === 'pending' ? pendingAlerts : alerts;

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-40 flex justify-end">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/50"
                    onClick={onClose}
                />

                {/* Panel */}
                <div className="relative w-full max-w-md h-full bg-[#111b21] shadow-xl flex flex-col">
                    {/* Header */}
                    <div className="h-14 px-4 flex items-center justify-between bg-[#202c33] flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <Bell className="w-5 h-5 text-[#00a884]" />
                            <h2 className="text-lg font-medium text-white">
                                Consultas Pendientes
                            </h2>
                            {pendingAlerts.length > 0 && (
                                <span className="px-2 py-0.5 bg-[#00a884] text-white text-xs font-bold rounded-full">
                                    {pendingAlerts.length}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExport}
                                className="p-2 text-[#aebac1] hover:bg-[#374248] rounded-full transition-colors"
                                title="Exportar CSV"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 text-[#aebac1] hover:bg-[#374248] rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Filter tabs */}
                    <div className="px-4 py-2 bg-[#111b21] border-b border-[#374248]">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => { setFilter('pending'); setShowFrequent(false); }}
                                className={clsx(
                                    "px-3 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap",
                                    filter === 'pending' && !showFrequent
                                        ? "bg-[#00a884] text-white"
                                        : "bg-[#2a3942] text-[#8696a0] hover:bg-[#374248]"
                                )}
                            >
                                Pendientes ({pendingAlerts.length})
                            </button>
                            <button
                                onClick={() => { setFilter('all'); setShowFrequent(false); }}
                                className={clsx(
                                    "px-3 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap",
                                    filter === 'all' && !showFrequent
                                        ? "bg-[#00a884] text-white"
                                        : "bg-[#2a3942] text-[#8696a0] hover:bg-[#374248]"
                                )}
                            >
                                Todas ({alerts.length})
                            </button>
                            <button
                                onClick={() => setShowFrequent(true)}
                                className={clsx(
                                    "px-3 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap flex items-center gap-2",
                                    showFrequent
                                        ? "bg-[#00a884] text-white"
                                        : "bg-[#2a3942] text-[#8696a0] hover:bg-[#374248]"
                                )}
                            >
                                Agrupadas
                                {frequentQuestions.length > 0 && (
                                    <span className="bg-white/20 px-1.5 rounded-full text-xs">
                                        {frequentQuestions.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Content list */}
                    <div className="flex-1 overflow-y-auto">
                        {showFrequent ? (
                            // Frequent Questions View
                            isLoadingFrequent ? (
                                <div className="flex items-center justify-center h-32">
                                    <Loader2 className="w-6 h-6 text-[#00a884] animate-spin" />
                                </div>
                            ) : frequentQuestions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                                    <Bell className="w-12 h-12 text-[#8696a0] mb-3" />
                                    <p className="text-[#e9edef] font-medium">
                                        No hay preguntas frecuentes similares
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[#374248]">
                                    {frequentQuestions.map((group, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => setSelectedAlert(group.latestAlert)}
                                            className="p-4 hover:bg-[#202c33] cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[#e9edef] font-medium text-sm line-clamp-1">
                                                            {group.question}
                                                        </span>
                                                        <span className="px-2 py-0.5 bg-[#00a884] text-white text-xs font-bold rounded-full flex-shrink-0">
                                                            {group.count} casos
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-[#8696a0]">
                                                        Última: {new Date(group.latestAlert.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-sm text-[#8696a0] line-clamp-2">
                                                {group.latestAlert.customerName} ({group.latestAlert.customerPhone}) preguntó esto recientemente.
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            // Standard Alerts View
                            isLoading ? (
                                <div className="flex items-center justify-center h-32">
                                    <Loader2 className="w-6 h-6 text-[#00a884] animate-spin" />
                                </div>
                            ) : displayAlerts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                                    <Bell className="w-12 h-12 text-[#8696a0] mb-3" />
                                    <p className="text-[#e9edef] font-medium">
                                        {filter === 'pending'
                                            ? 'No hay consultas pendientes'
                                            : 'No hay alertas'
                                        }
                                    </p>
                                    <p className="text-sm text-[#8696a0] mt-1">
                                        Las consultas que el bot no pueda responder aparecerán aquí
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[#374248]">
                                    {displayAlerts.map((alert) => (
                                        <AlertCard
                                            key={alert.id}
                                            alert={alert}
                                            onClick={() => setSelectedAlert(alert)}
                                        />
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Response Modal */}
            {selectedAlert && (
                <AlertResponseModal
                    alert={selectedAlert}
                    onClose={() => setSelectedAlert(null)}
                    onRespond={handleRespond}
                    onDismiss={handleDismiss}
                />
            )}
        </>
    );
};
