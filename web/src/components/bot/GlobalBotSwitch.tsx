import { useState, useEffect } from 'react';
import { Bot, BotOff, Loader2 } from 'lucide-react';
import { triggerApi } from '../../api/client';
import { clsx } from 'clsx';

export const GlobalBotSwitch = () => {
    const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await triggerApi.getConfig();
                if (response.data?.success) {
                    setIsEnabled(response.data.data.listenerEnabled);
                }
            } catch (error) {
                console.error('Failed to fetch trigger config:', error);
            }
        };
        fetchConfig();
    }, []);

    const handleToggle = async () => {
        if (isEnabled === null || isLoading) return;

        setIsLoading(true);
        try {
            const newStatus = !isEnabled;
            const response = await triggerApi.toggleListener(newStatus);
            if (response.data?.success) {
                setIsEnabled(newStatus);
            }
        } catch (error) {
            console.error('Failed to toggle global listener:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isEnabled === null) return null;

    return (
        <button
            onClick={handleToggle}
            disabled={isLoading}
            className={clsx(
                'w-12 h-12 rounded-full flex items-center justify-center transition-all relative group shadow-lg border',
                isEnabled
                    ? 'bg-[#00a884] text-white border-[#00a884] hover:bg-[#008f6f]'
                    : 'bg-[#374248] text-[#aebac1] border-[#4a555c] hover:bg-[#4a555c]'
            )}
            title={isEnabled ? 'Bot Global Activo (Encendido)' : 'Bot Global Inactivo (Apagado)'}
        >
            {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
            ) : isEnabled ? (
                <Bot className="w-6 h-6" />
            ) : (
                <BotOff className="w-6 h-6" />
            )}

            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 bg-[#3b4a54] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Bot: {isEnabled ? 'ENCENDIDO' : 'APAGADO'}
            </span>

            {/* Status Indicator Dot */}
            <span className={clsx(
                "absolute top-2 right-2 w-2 h-2 rounded-full border border-[#202c33]",
                isEnabled ? "bg-green-400 animate-pulse" : "bg-red-400"
            )} />
        </button>
    );
};
