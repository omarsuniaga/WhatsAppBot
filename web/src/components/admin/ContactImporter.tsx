/**
 * Contact Importer
 * Componente para importar contactos desde CSV o texto
 */

import { useState, useRef } from 'react';
import { 
    Upload, FileText, X, Check, AlertCircle, 
    Clipboard, Users
} from 'lucide-react';
import { broadcastApi } from '../../api/client';

interface ContactImporterProps {
    listId: string;
    onImportComplete: (result: { imported: number; skipped: number; errors: string[] }) => void;
    onClose: () => void;
}

interface ParsedContact {
    phone: string;
    name?: string;
    valid: boolean;
    error?: string;
}

export const ContactImporter = ({ listId, onImportComplete, onClose }: ContactImporterProps) => {
    const [mode, setMode] = useState<'file' | 'paste'>('paste');
    const [rawText, setRawText] = useState('');
    const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
    const [importing, setImporting] = useState(false);
    const [step, setStep] = useState<'input' | 'preview' | 'result'>('input');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const parseContacts = (text: string): ParsedContact[] => {
        const lines = text.trim().split('\n').filter(line => line.trim());
        const contacts: ParsedContact[] = [];

        for (const line of lines) {
            // Try different formats: "phone,name" or "phone\tname" or just "phone"
            const parts = line.split(/[,\t;|]/).map(p => p.trim());
            let phone = parts[0]?.replace(/\D/g, '') || '';
            let name = parts[1] || '';

            // Validate phone
            if (!phone) {
                contacts.push({ phone: line, valid: false, error: 'Número vacío' });
                continue;
            }

            if (phone.length < 10) {
                contacts.push({ phone, name, valid: false, error: 'Número muy corto' });
                continue;
            }

            if (phone.length > 15) {
                contacts.push({ phone, name, valid: false, error: 'Número muy largo' });
                continue;
            }

            contacts.push({ phone, name: name || phone, valid: true });
        }

        return contacts;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setRawText(text);
            const parsed = parseContacts(text);
            setParsedContacts(parsed);
            setStep('preview');
        };
        reader.readAsText(file);
    };

    const handlePastePreview = () => {
        const parsed = parseContacts(rawText);
        setParsedContacts(parsed);
        setStep('preview');
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const validContacts = parsedContacts
                .filter(c => c.valid)
                .map(c => ({ phone: c.phone, name: c.name }));

            const result = await broadcastApi.importContacts(listId, validContacts);
            onImportComplete(result.data.data);
            setStep('result');
        } catch (error) {
            console.error('Import error:', error);
        } finally {
            setImporting(false);
        }
    };

    const validCount = parsedContacts.filter(c => c.valid).length;
    const invalidCount = parsedContacts.filter(c => !c.valid).length;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Upload className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800">Importar Contactos</h3>
                            <p className="text-sm text-gray-500">
                                {step === 'input' && 'Sube un archivo o pega los contactos'}
                                {step === 'preview' && `${validCount} contactos válidos encontrados`}
                                {step === 'result' && 'Importación completada'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {step === 'input' && (
                        <div className="space-y-4">
                            {/* Mode Selector */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMode('paste')}
                                    className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                                        mode === 'paste' 
                                            ? 'border-whatsapp-green bg-whatsapp-green/5' 
                                            : 'border-gray-200'
                                    }`}
                                >
                                    <Clipboard className="w-5 h-5 mx-auto mb-1" />
                                    <p className="text-sm font-medium">Pegar Texto</p>
                                </button>
                                <button
                                    onClick={() => setMode('file')}
                                    className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                                        mode === 'file' 
                                            ? 'border-whatsapp-green bg-whatsapp-green/5' 
                                            : 'border-gray-200'
                                    }`}
                                >
                                    <FileText className="w-5 h-5 mx-auto mb-1" />
                                    <p className="text-sm font-medium">Subir Archivo</p>
                                </button>
                            </div>

                            {mode === 'paste' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Pega los contactos (uno por línea)
                                    </label>
                                    <textarea
                                        value={rawText}
                                        onChange={(e) => setRawText(e.target.value)}
                                        rows={10}
                                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green font-mono text-sm resize-none"
                                        placeholder={`18091234567, Juan Pérez\n18097654321, María García\n18095551234`}
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Formato: número, nombre (el nombre es opcional)
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv,.txt"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-whatsapp-green transition-colors"
                                    >
                                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                        <p className="text-gray-600 font-medium">
                                            Haz clic para subir un archivo
                                        </p>
                                        <p className="text-sm text-gray-400 mt-1">
                                            CSV o TXT (máx. 10MB)
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Format Help */}
                            <div className="bg-blue-50 rounded-lg p-4">
                                <p className="text-sm font-medium text-blue-800 mb-2">Formatos aceptados:</p>
                                <ul className="text-sm text-blue-700 space-y-1">
                                    <li>• <code className="bg-blue-100 px-1 rounded">18091234567</code> - Solo número</li>
                                    <li>• <code className="bg-blue-100 px-1 rounded">18091234567, Juan</code> - Número y nombre</li>
                                    <li>• <code className="bg-blue-100 px-1 rounded">+1 809 123 4567</code> - Con formato (se limpia automáticamente)</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            {/* Summary */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-green-600">{validCount}</p>
                                    <p className="text-sm text-green-700">Válidos</p>
                                </div>
                                <div className="bg-red-50 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-red-600">{invalidCount}</p>
                                    <p className="text-sm text-red-700">Con errores</p>
                                </div>
                            </div>

                            {/* Contact List Preview */}
                            <div className="border rounded-lg max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="text-left px-4 py-2 font-medium text-gray-600">Estado</th>
                                            <th className="text-left px-4 py-2 font-medium text-gray-600">Teléfono</th>
                                            <th className="text-left px-4 py-2 font-medium text-gray-600">Nombre</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {parsedContacts.slice(0, 50).map((contact, idx) => (
                                            <tr key={idx} className={contact.valid ? '' : 'bg-red-50'}>
                                                <td className="px-4 py-2">
                                                    {contact.valid ? (
                                                        <Check className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <AlertCircle className="w-4 h-4 text-red-500" />
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 font-mono">{contact.phone}</td>
                                                <td className="px-4 py-2">
                                                    {contact.valid ? contact.name : (
                                                        <span className="text-red-600 text-xs">{contact.error}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedContacts.length > 50 && (
                                    <p className="text-center py-2 text-sm text-gray-500 bg-gray-50">
                                        ... y {parsedContacts.length - 50} más
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'result' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">
                                ¡Importación Completada!
                            </h3>
                            <p className="text-gray-600">
                                Los contactos han sido agregados a la lista.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t flex justify-between">
                    {step === 'preview' && (
                        <button
                            onClick={() => setStep('input')}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            ← Volver
                        </button>
                    )}
                    {step !== 'preview' && <div />}

                    <div className="flex gap-2">
                        {step === 'input' && (
                            <button
                                onClick={handlePastePreview}
                                disabled={!rawText.trim()}
                                className="px-6 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50"
                            >
                                Vista Previa
                            </button>
                        )}
                        {step === 'preview' && (
                            <button
                                onClick={handleImport}
                                disabled={validCount === 0 || importing}
                                className="flex items-center gap-2 px-6 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50"
                            >
                                <Users className="w-4 h-4" />
                                {importing ? 'Importando...' : `Importar ${validCount} Contactos`}
                            </button>
                        )}
                        {step === 'result' && (
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark"
                            >
                                Cerrar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactImporter;
