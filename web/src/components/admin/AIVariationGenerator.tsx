/**
 * AIVariationGenerator - Component for generating question variations using AI
 */

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface AIVariationGeneratorProps {
    baseQuestion: string;
    onSelect: (variations: string[]) => void;
}

export const AIVariationGenerator = ({ baseQuestion, onSelect }: AIVariationGeneratorProps) => {
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());

    const generateVariations = async () => {
        if (!baseQuestion.trim()) {
            alert('Escribe una pregunta base primero');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('http://localhost:3001/api/knowledge/generate-variations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-api-key': localStorage.getItem('ADMIN_API_KEY') || 'dev-admin-key-123'
                },
                body: JSON.stringify({ question: baseQuestion })
            });

            const data = await response.json();
            if (data.success && data.data) {
                setSuggestions(data.data);
                setSelected(new Set(data.data.map((_: string, i: number) => i))); // Select all by default
            } else {
                alert('Error generando variaciones');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al conectar con el servicio de AI');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (index: number) => {
        const newSelected = new Set(selected);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelected(newSelected);
    };

    const applySelections = () => {
        const selectedVariations = suggestions.filter((_, i) => selected.has(i));
        onSelect(selectedVariations);
        setSuggestions([]);
        setSelected(new Set());
    };

    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={generateVariations}
                disabled={loading || !baseQuestion.trim()}
                className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
            >
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generando con AI...
                    </>
                ) : (
                    <>
                        <Sparkles className="w-4 h-4" />
                        ✨ Generar variaciones con AI
                    </>
                )}
            </button>

            {suggestions.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3">
                        Variaciones sugeridas (selecciona las que quieras):
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {suggestions.map((suggestion, idx) => (
                            <label
                                key={idx}
                                className="flex items-start gap-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 p-2 rounded"
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.has(idx)}
                                    onChange={() => toggleSelection(idx)}
                                    className="mt-0.5 w-4 h-4 text-orange-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-orange-500"
                                />
                                <span className="text-sm text-gray-800 dark:text-gray-200">
                                    {suggestion}
                                </span>
                            </label>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                        <button
                            type="button"
                            onClick={() => {
                                setSuggestions([]);
                                setSelected(new Set());
                            }}
                            className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={applySelections}
                            disabled={selected.size === 0}
                            className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Añadir {selected.size} variaciones
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
