import { X, Sticker, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface StickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (url: string) => Promise<void>;
}

export const StickerModal = ({ isOpen, onClose, onSend }: StickerModalProps) => {
    const [url, setUrl] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setIsSending(true);
        try {
            await onSend(url);
            onClose();
            setUrl('');
        } catch (error) {
            console.error('Error sending sticker:', error);
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
                        <Sticker className="w-5 h-5 text-orange-500" />
                        Enviar Sticker
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">URL del Sticker</label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://ejemplo.com/sticker.webp"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">Debe ser una URL pública a una imagen.</p>
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
                            disabled={isSending || !url}
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
