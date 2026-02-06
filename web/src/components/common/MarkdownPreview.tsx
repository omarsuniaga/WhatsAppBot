/**
 * MarkdownPreview - Simple Markdown preview component
 */

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface MarkdownPreviewProps {
    content: string;
    onChange: (value: string) => void;
    rows?: number;
    placeholder?: string;
}

export const MarkdownPreview = ({ content, onChange, rows = 4, placeholder }: MarkdownPreviewProps) => {
    const [showPreview, setShowPreview] = useState(false);

    // Simple markdown to HTML converter (basic support)
    const renderMarkdown = (text: string) => {
        let html = text;

        // Headers
        html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mb-2">$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mb-2">$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mb-3">$1</h1>');

        // Bold and italic
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');

        // Lists
        html = html.replace(/^\- (.+)$/gm, '<li class="ml-4">• $1</li>');
        html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$1. $2</li>');

        // Line breaks
        html = html.replace(/\n\n/g, '</p><p class="mb-2">');
        html = '<p class="mb-2">' + html + '</p>';

        return html;
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Respuesta {showPreview && '(Preview)'}
                </label>
                <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400 hover:underline"
                >
                    {showPreview ? (
                        <>
                            <EyeOff className="w-4 h-4" />
                            Editor
                        </>
                    ) : (
                        <>
                            <Eye className="w-4 h-4" />
                            Preview
                        </>
                    )}
                </button>
            </div>

            {showPreview ? (
                <div
                    className="w-full min-h-[100px] px-3 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200 prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                />
            ) : (
                <textarea
                    value={content}
                    onChange={(e) => onChange(e.target.value)}
                    rows={rows}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-orange-500 resize-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                />
            )}

            {!showPreview && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Soporta: # Títulos, **negrita**, *cursiva*, - listas
                </p>
            )}
        </div>
    );
};
