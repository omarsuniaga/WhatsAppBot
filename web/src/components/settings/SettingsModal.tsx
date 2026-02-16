import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { aiApi } from '../../api/client';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
    const [apiKey, setApiKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        if (isOpen) {
            // Load from localStorage when opening
            const savedKey = localStorage.getItem('GEMINI_API_KEY');
            if (savedKey) {
                setApiKey(savedKey);
            }
            setStatus('idle');
        }
    }, [isOpen]);

    const handleSave = async () => {
        if (!apiKey.trim()) return;

        setIsLoading(true);
        setStatus('idle');
        try {
            // 1. Save to LocalStorage
            localStorage.setItem('GEMINI_API_KEY', apiKey);

            // 2. Send to Backend
            await aiApi.updateConfig({ geminiApiKey: apiKey });

            setStatus('success');
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (error) {
            console.error('Failed to save API key:', error);
            setStatus('error');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md relative animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">Configuración IA</h2>
                    <button 
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Gemini API Key
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                            Ingresa tu clave de API de Google Gemini para habilitar las respuestas automáticas.
                        </p>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Ej: AIzaSy..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                        />
                    </div>

                    {status === 'success' && (
                        <p className="text-sm text-green-600 font-medium">
                            ¡Configuración guardada correctamente!
                        </p>
                    )}
                    
                    {status === 'error' && (
                        <p className="text-sm text-red-600 font-medium">
                            Error al guardar la configuración. Intenta de nuevo.
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-4 bg-gray-50 rounded-b-lg border-t">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || !apiKey.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-whatsapp-green hover:bg-whatsapp-dark rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
