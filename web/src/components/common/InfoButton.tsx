/**
 * InfoButton - Componente reutilizable para mostrar información de ayuda
 * Muestra un botón con icono de información y un modal con descripción
 */

import { useState } from 'react';
import { Info, X } from 'lucide-react';

interface InfoButtonProps {
  title: string;
  description: string;
  tips?: string[];
  shortcut?: string;
}

export const InfoButton = ({ title, description, tips, shortcut }: InfoButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Botón Info */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 transition-colors duration-200"
        title="Ver información sobre esta vista"
        aria-label="Ver información"
      >
        <Info size={18} />
      </button>

      {/* Modal de información */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info size={24} />
                <h2 className="text-lg font-semibold">{title}</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/20 rounded-full p-1 transition-colors"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Descripción principal */}
              <div>
                <p className="text-gray-700 leading-relaxed">{description}</p>
              </div>

              {/* Tips */}
              {tips && tips.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                  <h3 className="font-semibold text-blue-900 mb-2 text-sm">💡 Tips útiles:</h3>
                  <ul className="space-y-2">
                    {tips.map((tip, index) => (
                      <li key={index} className="text-sm text-blue-800 flex gap-2">
                        <span className="text-blue-500 font-bold">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Atajo de teclado */}
              {shortcut && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">ATAJO DE TECLADO</p>
                  <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                    {shortcut}
                  </p>
                </div>
              )}
            </div>

            {/* Footer - Botón cerrar */}
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
