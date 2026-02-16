import { Wifi, WifiOff, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface WhatsAppStatusProps {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  className?: string;
}

export const WhatsAppStatus = ({ status, className }: WhatsAppStatusProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-green-600',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          text: 'Conectado',
          subtext: 'WhatsApp listo para enviar mensajes'
        };
      case 'connecting':
        return {
          icon: Loader2,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          text: 'Conectando...',
          subtext: 'Estableciendo conexión con WhatsApp'
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-red-600',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          text: 'Desconectado',
          subtext: 'Debes iniciar sesión en WhatsApp'
        };
      case 'error':
        return {
          icon: AlertTriangle,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
          borderColor: 'border-orange-200 dark:border-orange-800',
          text: 'Error de Conexión',
          subtext: 'Revisa tu conexión y reintenta'
        };
      default:
        return {
          icon: WifiOff,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          borderColor: 'border-gray-200 dark:border-gray-800',
          text: 'Estado Desconocido',
          subtext: 'Verificando conexión...'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200',
      config.bgColor,
      config.borderColor,
      className
    )}>
      <div className={cn('p-2 rounded-lg bg-white dark:bg-gray-800', config.color)}>
        <Icon className={cn('w-5 h-5', status === 'connecting' && 'animate-spin')} />
      </div>

      <div className="flex-1">
        <h4 className={cn('font-bold text-sm', config.color)}>
          {config.text}
        </h4>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          {config.subtext}
        </p>
      </div>

      {status === 'disconnected' && (
        <button
          onClick={() => window.location.href = '/whatsapp/chats'}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors"
        >
          Conectar Ahora
        </button>
      )}

      {status === 'error' && (
        <button className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-colors">
          Reintentar
        </button>
      )}
    </div>
  );
};