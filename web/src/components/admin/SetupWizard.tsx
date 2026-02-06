/**
 * Setup Wizard
 * Asistente de configuración inicial del sistema
 */

import { useState, useEffect } from 'react';
import { 
    Wand2, Key, User, Building2, Check, ChevronRight, 
    ChevronLeft, AlertCircle, Loader2
} from 'lucide-react';
import { escalationApi, knowledgeApi, aiApi } from '../../api/client';

interface SetupWizardProps {
    onComplete: () => void;
    onSkip: () => void;
}

type Step = 'welcome' | 'business' | 'gemini' | 'admin' | 'complete';

const STORAGE_KEY = 'setup_wizard_data';

interface WizardFormData {
    currentStep: Step;
    businessName: string;
    businessDescription: string;
    businessTone: 'professional' | 'friendly' | 'formal';
    geminiKey: string;
    adminPhone: string;
    adminName: string;
}

const getStoredData = (): Partial<WizardFormData> => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
};

export const SetupWizard = ({ onComplete, onSkip }: SetupWizardProps) => {
    // Load initial data from localStorage
    const storedData = getStoredData();
    
    const [currentStep, setCurrentStep] = useState<Step>(storedData.currentStep || 'welcome');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form data - initialized from localStorage if available
    const [businessName, setBusinessName] = useState(storedData.businessName || '');
    const [businessDescription, setBusinessDescription] = useState(storedData.businessDescription || '');
    const [businessTone, setBusinessTone] = useState<'professional' | 'friendly' | 'formal'>(storedData.businessTone || 'professional');
    const [geminiKey, setGeminiKey] = useState(storedData.geminiKey || '');
    const [adminPhone, setAdminPhone] = useState(storedData.adminPhone || '');
    const [adminName, setAdminName] = useState(storedData.adminName || '');

    // Persist form data to localStorage whenever it changes
    useEffect(() => {
        const dataToStore: WizardFormData = {
            currentStep,
            businessName,
            businessDescription,
            businessTone,
            geminiKey,
            adminPhone,
            adminName
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
    }, [currentStep, businessName, businessDescription, businessTone, geminiKey, adminPhone, adminName]);

    const steps: { id: Step; title: string; icon: any }[] = [
        { id: 'welcome', title: 'Bienvenida', icon: Wand2 },
        { id: 'business', title: 'Tu Negocio', icon: Building2 },
        { id: 'gemini', title: 'API de IA', icon: Key },
        { id: 'admin', title: 'Administrador', icon: User },
        { id: 'complete', title: 'Completado', icon: Check },
    ];

    const currentIndex = steps.findIndex(s => s.id === currentStep);

    const handleNext = async () => {
        setError(null);
        setLoading(true);

        try {
            switch (currentStep) {
                case 'welcome':
                    setCurrentStep('business');
                    break;

                case 'business':
                    if (businessName) {
                        await knowledgeApi.updateConfig({
                            businessName,
                            businessDescription,
                            toneStyle: businessTone
                        });
                    }
                    setCurrentStep('gemini');
                    break;

                case 'gemini':
                    if (geminiKey) {
                        await aiApi.updateConfig(geminiKey);
                        localStorage.setItem('GEMINI_API_KEY', geminiKey);
                    }
                    setCurrentStep('admin');
                    break;

                case 'admin':
                    if (adminPhone && adminName) {
                        const phone = adminPhone.replace(/\D/g, '');
                        await escalationApi.addAdmin({
                            jid: `${phone}@s.whatsapp.net`,
                            name: adminName,
                            role: 'super_admin',
                            notifyOnNewTicket: true,
                            notifyOnUrgent: true
                        });
                    }
                    setCurrentStep('complete');
                    break;

                case 'complete':
                    // Clear stored data on successful completion
                    localStorage.removeItem(STORAGE_KEY);
                    onComplete();
                    break;
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
            setCurrentStep(steps[prevIndex].id);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
                {/* Progress */}
                <div className="bg-gray-50 px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                        {steps.map((step, idx) => (
                            <div key={step.id} className="flex items-center">
                                <div className={`
                                    w-10 h-10 rounded-full flex items-center justify-center
                                    ${idx < currentIndex ? 'bg-whatsapp-green text-white' : ''}
                                    ${idx === currentIndex ? 'bg-whatsapp-green text-white ring-4 ring-whatsapp-green/20' : ''}
                                    ${idx > currentIndex ? 'bg-gray-200 text-gray-400' : ''}
                                `}>
                                    {idx < currentIndex ? (
                                        <Check className="w-5 h-5" />
                                    ) : (
                                        <step.icon className="w-5 h-5" />
                                    )}
                                </div>
                                {idx < steps.length - 1 && (
                                    <div className={`w-12 h-1 mx-2 rounded ${
                                        idx < currentIndex ? 'bg-whatsapp-green' : 'bg-gray-200'
                                    }`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    {/* Welcome Step */}
                    {currentStep === 'welcome' && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-whatsapp-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Wand2 className="w-10 h-10 text-whatsapp-green" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">
                                ¡Bienvenido al Asistente de Configuración!
                            </h2>
                            <p className="text-gray-600 mb-6 max-w-md mx-auto">
                                Te guiaremos paso a paso para configurar tu bot inteligente de WhatsApp.
                                Solo tomará unos minutos.
                            </p>
                            <div className="bg-blue-50 rounded-lg p-4 text-left max-w-md mx-auto">
                                <p className="text-sm text-blue-800">
                                    <strong>Configuraremos:</strong>
                                </p>
                                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                                    <li>• Información de tu negocio</li>
                                    <li>• Conexión con Gemini AI para respuestas inteligentes</li>
                                    <li>• Tu cuenta de administrador para notificaciones</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Business Step */}
                    {currentStep === 'business' && (
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Building2 className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">Tu Negocio</h2>
                                    <p className="text-gray-500 text-sm">Esta información se usará en las respuestas del bot</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Nombre del Negocio *
                                    </label>
                                    <input
                                        type="text"
                                        value={businessName}
                                        onChange={(e) => setBusinessName(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                        placeholder="Ej: Tienda Mi Empresa"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Descripción breve
                                    </label>
                                    <textarea
                                        value={businessDescription}
                                        onChange={(e) => setBusinessDescription(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-whatsapp-green resize-none"
                                        placeholder="Ej: Somos una tienda de productos electrónicos con más de 10 años de experiencia..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tono de las respuestas
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {(['professional', 'friendly', 'formal'] as const).map(tone => (
                                            <button
                                                key={tone}
                                                onClick={() => setBusinessTone(tone)}
                                                className={`p-3 rounded-lg border-2 transition-colors ${
                                                    businessTone === tone
                                                        ? 'border-whatsapp-green bg-whatsapp-green/5'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                <p className="font-medium capitalize">
                                                    {tone === 'professional' ? 'Profesional' : 
                                                     tone === 'friendly' ? 'Amigable' : 'Formal'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {tone === 'professional' ? 'Equilibrado y cortés' :
                                                     tone === 'friendly' ? 'Cercano y casual' : 'Serio y respetuoso'}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Gemini Step */}
                    {currentStep === 'gemini' && (
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <Key className="w-6 h-6 text-purple-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">API de Gemini</h2>
                                    <p className="text-gray-500 text-sm">Conecta con la IA de Google para respuestas inteligentes</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Gemini API Key
                                    </label>
                                    <input
                                        type="password"
                                        value={geminiKey}
                                        onChange={(e) => setGeminiKey(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-whatsapp-green font-mono"
                                        placeholder="AIza..."
                                    />
                                </div>

                                <div className="bg-yellow-50 rounded-lg p-4">
                                    <p className="text-sm text-yellow-800 font-medium mb-2">
                                        ¿Cómo obtener una API Key?
                                    </p>
                                    <ol className="text-sm text-yellow-700 space-y-1">
                                        <li>1. Ve a <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></li>
                                        <li>2. Inicia sesión con tu cuenta de Google</li>
                                        <li>3. Crea una nueva API Key</li>
                                        <li>4. Cópiala y pégala aquí</li>
                                    </ol>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">
                                        <strong>Nota:</strong> Sin la API Key, el bot solo usará respuestas de la base de conocimiento.
                                        Con Gemini, podrá entender mejor las preguntas y dar respuestas más naturales.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Admin Step */}
                    {currentStep === 'admin' && (
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                                    <User className="w-6 h-6 text-orange-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">Administrador Principal</h2>
                                    <p className="text-gray-500 text-sm">Recibirás notificaciones de tickets por WhatsApp</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Nombre *
                                    </label>
                                    <input
                                        type="text"
                                        value={adminName}
                                        onChange={(e) => setAdminName(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                        placeholder="Tu nombre"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Número de WhatsApp *
                                    </label>
                                    <input
                                        type="tel"
                                        value={adminPhone}
                                        onChange={(e) => setAdminPhone(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                        placeholder="Ej: 18091234567"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Incluye el código de país sin el + (ej: 1809... para Rep. Dominicana)
                                    </p>
                                </div>

                                <div className="bg-blue-50 rounded-lg p-4">
                                    <p className="text-sm text-blue-800">
                                        <strong>Como administrador podrás:</strong>
                                    </p>
                                    <ul className="text-sm text-blue-700 mt-2 space-y-1">
                                        <li>• Recibir notificaciones de tickets nuevos</li>
                                        <li>• Responder tickets directamente desde WhatsApp</li>
                                        <li>• Ver alertas de consultas urgentes</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Complete Step */}
                    {currentStep === 'complete' && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Check className="w-10 h-10 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">
                                ¡Configuración Completada!
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Tu bot está listo para comenzar a responder automáticamente.
                            </p>
                            <div className="bg-green-50 rounded-lg p-4 text-left max-w-md mx-auto">
                                <p className="text-sm text-green-800 font-medium mb-2">Próximos pasos:</p>
                                <ul className="text-sm text-green-700 space-y-1">
                                    <li>✓ Revisa las FAQs en "Base de Conocimiento"</li>
                                    <li>✓ Agrega tus propias preguntas frecuentes</li>
                                    <li>✓ Crea listas de contactos para difusión</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-gray-50 border-t flex justify-between">
                    <div>
                        {currentStep !== 'welcome' && currentStep !== 'complete' && (
                            <button
                                onClick={handleBack}
                                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Atrás
                            </button>
                        )}
                    </div>

                    <div className="flex gap-3">
                        {currentStep !== 'complete' && (
                            <button
                                onClick={onSkip}
                                className="px-4 py-2 text-gray-500 hover:text-gray-700"
                            >
                                Omitir
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : currentStep === 'complete' ? (
                                'Ir al Dashboard'
                            ) : (
                                <>
                                    Continuar
                                    <ChevronRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetupWizard;
