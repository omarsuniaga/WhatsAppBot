import { HelpCircle } from 'lucide-react';
import { ATTENDANCE_HELP_DISMISSED_KEY } from '../utils';

interface HelpModalProps {
    onClose: () => void;
    dismissHelpPermanently: boolean;
    setDismissHelpPermanently: (val: boolean) => void;
}

export const HelpModal = ({ onClose, dismissHelpPermanently, setDismissHelpPermanently }: HelpModalProps) => (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] p-4 flex items-center justify-center">
        <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="p-4 sm:p-5 border-b dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-indigo-500" />
                    Guía rápida del panel
                </h2>
                <button onClick={onClose} className="px-2 py-1 text-sm font-semibold text-gray-500 hover:text-gray-700"> Cerrar </button>
            </div>
            <div className="p-4 sm:p-5 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <p><span className="font-semibold text-gray-800 dark:text-gray-100">1.</span> Usa los filtros para definir el periodo.</p>
                <p><span className="font-semibold text-gray-800 dark:text-gray-100">2.</span> Revisa métricas arriba para detectar riesgos rápidos.</p>
                <p><span className="font-semibold text-gray-800 dark:text-gray-100">3.</span> Alumnos en Riesgo: usa WhatsApp para alertar representantes.</p>
                <p><span className="font-semibold text-gray-800 dark:text-gray-100">4.</span> Reportes Pendientes: envía recordatorio a docentes.</p>
                <p><span className="font-semibold text-gray-800 dark:text-gray-100">5.</span> Feed de Observaciones: marca justificativos e incidencias.</p>
                <label className="mt-2 inline-flex items-center gap-2 text-xs sm:text-sm">
                    <input
                        type="checkbox"
                        checked={dismissHelpPermanently}
                        onChange={(e) => {
                            const checked = e.target.checked;
                            setDismissHelpPermanently(checked);
                            if (typeof window !== 'undefined') {
                                window.localStorage.setItem(ATTENDANCE_HELP_DISMISSED_KEY, checked ? 'true' : 'false');
                            }
                        }}
                        className="rounded border-gray-300 text-indigo-600"
                    />
                    No volver a mostrar automáticamente
                </label>
            </div>
        </div>
    </div>
);
