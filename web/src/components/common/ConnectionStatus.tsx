import { useStore } from '../../store';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

export const ConnectionStatus = () => {
    const { connectionStatus } = useStore();

    const config = {
        connected: {
            icon: <Wifi className="w-4 h-4" />,
            text: 'Conectado',
            className: 'text-green-600 bg-green-100'
        },
        connecting: {
            icon: <Loader2 className="w-4 h-4 animate-spin" />,
            text: 'Conectando...',
            className: 'text-yellow-600 bg-yellow-100'
        },
        disconnected: {
            icon: <WifiOff className="w-4 h-4" />,
            text: 'Desconectado',
            className: 'text-red-600 bg-red-100'
        }
    }[connectionStatus];

    return (
        <div className={clsx(
            'flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium',
            config.className
        )}>
            {config.icon}
            <span>{config.text}</span>
        </div>
    );
};
