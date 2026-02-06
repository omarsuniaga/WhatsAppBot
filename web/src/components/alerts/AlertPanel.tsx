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

    useEffect(() => {
        if (isOpen) {
            fetchAlerts();
        }
    }, [isOpen, filter]);

    // Listen for WebSocket events
    useEffect(() => {
        const handleNewAlert = (alert: PendingAlert) => {
            setAlerts(prev => {
                const newAlerts = [alert, ...prev];
                const pendingCount = newAlerts.filter(a => a.status === 'pending').length;
                onAlertCountChange?.(pendingCount);
                return newAlerts;
            });
            // Play notification sound
            playNotificationSound();
        };

        const handleAlertResponded = (data: { alertId: string }) => {
            setAlerts(prev => prev.map(a => 
                a.id === data.alertId ? { ...a, status: 'answered' as const } : a
            ));
            fetchAlerts(); // Refresh to get updated count
        };

        const handleAlertDismissed = (data: { alertId: string }) => {
            setAlerts(prev => prev.map(a => 
                a.id === data.alertId ? { ...a, status: 'dismissed' as const } : a
            ));
            fetchAlerts();
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
    }, [onAlertCountChange]);

    const playNotificationSound = () => {
        try {
            const audio = new Audio('/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch (e) {
            // Ignore audio errors
        }
    };

    const handleRespond = async (alertId: string, response: string, shouldLearn: boolean) => {
        try {
            await alertApi.respondToAlert(alertId, response, shouldLearn);
            setSelectedAlert(null);
            fetchAlerts();
        } catch (error) {
            console.error('Error responding to alert:', error);
        }
    };

    const handleDismiss = async (alertId: string, reason?: string) => {
        try {
            await alertApi.dismissAlert(alertId, reason);
            setSelectedAlert(null);
            fetchAlerts();
        } catch (error) {
            console.error('Error dismissing alert:', error);
        }
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
                        <button
                            onClick={onClose}
                            className="p-2 text-[#aebac1] hover:bg-[#374248] rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Filter tabs */}
                    <div className="px-4 py-2 bg-[#111b21] border-b border-[#374248]">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilter('pending')}
                                className={clsx(
                                    "px-3 py-1.5 rounded-full text-sm transition-colors",
                                    filter === 'pending'
                                        ? "bg-[#00a884] text-white"
                                        : "bg-[#2a3942] text-[#8696a0] hover:bg-[#374248]"
                                )}
                            >
                                Pendientes ({pendingAlerts.length})
                            </button>
                            <button
                                onClick={() => setFilter('all')}
                                className={clsx(
                                    "px-3 py-1.5 rounded-full text-sm transition-colors",
                                    filter === 'all'
                                        ? "bg-[#00a884] text-white"
                                        : "bg-[#2a3942] text-[#8696a0] hover:bg-[#374248]"
                                )}
                            >
                                Todas ({alerts.length})
                            </button>
                        </div>
                    </div>

                    {/* Alerts list */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
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
