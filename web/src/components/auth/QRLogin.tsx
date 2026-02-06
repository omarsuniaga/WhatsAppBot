import { QRCodeSVG } from 'qrcode.react';
import { useStore } from '../../store';
import { Loader2, Smartphone, Wifi } from 'lucide-react';

export const QRLogin = () => {
    const { qrCode, pairingCode, connectionStatus } = useStore();

    return (
        <div className="min-h-screen bg-gradient-to-br from-whatsapp-dark to-whatsapp-teal flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-whatsapp-green rounded-full flex items-center justify-center mx-auto mb-4">
                        <Smartphone className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        WhatsApp Bot Web
                    </h1>
                    <p className="text-gray-500 mt-2">
                        Conecta tu WhatsApp para comenzar
                    </p>
                </div>

                <div className="flex flex-col items-center">
                    {connectionStatus === 'connecting' && qrCode ? (
                        <>
                            <div className="bg-white p-4 rounded-lg shadow-inner border-2 border-gray-100">
                                <QRCodeSVG
                                    value={qrCode}
                                    size={220}
                                    level="M"
                                    includeMargin={false}
                                />
                            </div>
                            <div className="mt-6 text-center">
                                <p className="text-gray-700 font-medium">
                                    Escanea el codigo QR
                                </p>
                                <ol className="text-sm text-gray-500 mt-3 text-left list-decimal list-inside space-y-1">
                                    <li>Abre WhatsApp en tu telefono</li>
                                    <li>Toca Menu o Configuracion</li>
                                    <li>Selecciona Dispositivos vinculados</li>
                                    <li>Apunta al codigo QR</li>
                                </ol>
                            </div>
                        </>
                    ) : pairingCode ? (
                        <div className="text-center">
                            <div className="bg-gray-100 rounded-lg p-6 mb-4">
                                <p className="text-sm text-gray-500 mb-2">
                                    Codigo de vinculacion
                                </p>
                                <p className="text-3xl font-mono font-bold text-whatsapp-dark tracking-widest">
                                    {pairingCode}
                                </p>
                            </div>
                            <p className="text-sm text-gray-500">
                                Ingresa este codigo en tu WhatsApp
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center py-8">
                            <Loader2 className="w-12 h-12 text-whatsapp-green animate-spin" />
                            <p className="mt-4 text-gray-600">
                                {connectionStatus === 'disconnected'
                                    ? 'Iniciando conexion...'
                                    : 'Esperando codigo QR...'}
                            </p>
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center gap-4">
                    <div className="flex items-center justify-center gap-2 text-sm">
                        <Wifi className={`w-4 h-4 ${connectionStatus === 'connected'
                                ? 'text-whatsapp-green'
                                : connectionStatus === 'connecting'
                                    ? 'text-yellow-500'
                                    : 'text-red-500'
                            }`} />
                        <span className="text-gray-500">
                            Estado: {
                                connectionStatus === 'connected'
                                    ? 'Conectado'
                                    : connectionStatus === 'connecting'
                                        ? 'Conectando...'
                                        : 'Desconectado'
                            }
                        </span>
                    </div>

                    <button
                        onClick={async () => {
                            if (confirm('¿Estás seguro de que deseas reiniciar la sesión? Esto desconectará el bot.')) {
                                const { statusApi } = await import('../../api/client');
                                await statusApi.logout();
                                window.location.reload();
                            }
                        }}
                        className="text-xs text-red-500 hover:text-red-700 underline"
                    >
                        Reiniciar Sesión
                    </button>
                </div>
            </div>
        </div>
    );
};
