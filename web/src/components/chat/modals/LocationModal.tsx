import { X, MapPin, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface LocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (lat: string, lon: string) => Promise<void>;
}

export const LocationModal = ({ isOpen, onClose, onSend }: LocationModalProps) => {
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!latitude || !longitude) return;

        setIsSending(true);
        try {
            await onSend(latitude, longitude);
            onClose();
            setLatitude('');
            setLongitude('');
        } catch (error) {
            console.error('Error sending location:', error);
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm relative animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-red-500" />
                        Enviar Ubicación
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Latitud</label>
                        <input
                            type="text"
                            value={latitude}
                            onChange={(e) => setLatitude(e.target.value)}
                            placeholder="Ej: 4.6097"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Longitud</label>
                        <input
                            type="text"
                            value={longitude}
                            onChange={(e) => setLongitude(e.target.value)}
                            placeholder="Ej: -74.0818"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSending || !latitude || !longitude}
                            className="px-4 py-2 text-sm font-medium text-white bg-whatsapp-green hover:bg-whatsapp-dark rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Enviar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
