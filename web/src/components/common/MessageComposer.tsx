import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Save, X, Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onGenerateDraft?: () => Promise<void>;
  onSaveTemplate?: (templateName: string) => Promise<void>;
  sending?: boolean;
  generating?: boolean;
  saving?: boolean;
  placeholder?: string;
  maxLength?: number;
  showCharacterCount?: boolean;
  className?: string;
  disabled?: boolean;
}

export const MessageComposer = ({
  value,
  onChange,
  onSend,
  onGenerateDraft,
  onSaveTemplate,
  sending = false,
  generating = false,
  saving = false,
  placeholder = 'Escribe tu mensaje aquí...',
  maxLength = 1000,
  showCharacterCount = true,
  className,
  disabled = false
}: MessageComposerProps) => {
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !value.trim()) return;
    
    try {
      await onSaveTemplate?.(templateName.trim());
      setShowSaveTemplate(false);
      setTemplateName('');
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const characterCount = value.length;
  const isNearLimit = characterCount > maxLength * 0.9;
  const isAtLimit = characterCount >= maxLength;

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm', className)}>
      {/* Header with Actions */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
          Mensaje de Recordatorio
        </h3>
        
        <div className="flex items-center gap-2">
          {onGenerateDraft && (
            <button
              onClick={onGenerateDraft}
              disabled={generating || disabled}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {generating ? 'Generando...' : 'Generar con IA'}
            </button>
          )}
          
          {onSaveTemplate && (
            <button
              onClick={() => setShowSaveTemplate(true)}
              disabled={!value.trim() || saving || disabled}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3 h-3" />
              Guardar Plantilla
            </button>
          )}
        </div>
      </div>

      {/* Save Template Modal */}
      {showSaveTemplate && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Nombre de la plantilla..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
            
            <button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim() || saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            
            <button
              onClick={() => {
                setShowSaveTemplate(false);
                setTemplateName('');
              }}
              className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Message Textarea */}
      <div className="p-4">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={disabled}
            className="w-full px-4 py-3 pr-20 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
            rows={3}
            style={{ minHeight: '100px' }}
          />
          
          {/* Send Button */}
          <button
            onClick={onSend}
            disabled={!value.trim() || sending || disabled}
            className={cn(
              'absolute bottom-3 right-3 px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2',
              value.trim() && !sending && !disabled
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            )}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>

        {/* Character Count and Helper Text */}
        {(showCharacterCount || maxLength) && (
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Tip:</span> Usa {'{nombre}'} para personalizar con el nombre del contacto
            </div>
            
            {maxLength && (
              <div className={cn(
                'text-xs font-medium',
                isAtLimit ? 'text-red-600 dark:text-red-400' : 
                isNearLimit ? 'text-yellow-600 dark:text-yellow-400' : 
                'text-gray-500 dark:text-gray-400'
              )}>
                {characterCount}/{maxLength}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview */}
      {value.trim() && (
        <div className="px-4 pb-4">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Vista Previa:
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {value}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
