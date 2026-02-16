import { useState } from 'react';
import { 
  Bell, Clock, Calendar, Send, 
  Sparkles, Bookmark, X, RefreshCw, AlertTriangle,
  Users, Zap, HelpCircle, CheckCircle
} from 'lucide-react';
import { useDailyReminder } from '../../hooks/useDailyReminder';
import { WhatsAppStatus } from '../common/WhatsAppStatus';
import { ContactSelector } from '../common/ContactSelector';
import { MessageComposer } from '../common/MessageComposer';
import type { ReminderTemplate } from '../../hooks/useDailyReminder';

type TabType = 'manual' | 'auto';

const DAYS_CATEGORIES = ['General', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Especial'];

export const DailyReminderPanel = () => {
  const [activeTab, setActiveTab] = useState<TabType>('manual');

  const [templateFilter, setTemplateFilter] = useState('General');
  
  const {
    // State
    config,
    loading,
    error,
    draftMessage,
    selectedRecipients,
    availableContacts,
    isWhatsAppConnected,
    generatingDraft,
    saving,
    scheduling,
    scheduleDateTime,
    aiTestStatus,
    aiTestMessage,
    aiConfig,
    templates,
    
    // Actions
    generateDraft,
    setDraftMessage,
    sendNow,
    addRecipient,
    removeRecipient,
    testAI,
    updateAIConfig,
    saveTemplate,
    scheduleMessage,
    setScheduleDateTime,
    loadTemplate,
    deleteTemplate,
    clearError,
    saveConfig: saveReminderConfig
  } = useDailyReminder();

  // Handle configuration changes
  const handleConfigChange = (key: string, value: any) => {
    if (!config) return;
    
    const newConfig = { ...config, [key]: value };
    saveReminderConfig(newConfig);
  };

  // Template management
  const filteredTemplates = (templates || []).filter((template: ReminderTemplate) => 
    templateFilter === 'General' || template.category === templateFilter
  );

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Bell className="w-7 h-7" />
              Recordatorios Diarios
            </h1>
            <p className="text-indigo-100 mt-2">
              Automatiza el envío de mensajes recordatorios a tus grupos y contactos de WhatsApp
            </p>
          </div>
          
          <button
            title="Funcionalidad de ayuda próximamente"
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <HelpCircle className="w-4 h-4" />
            Ayuda
          </button>
        </div>
      </div>

      {/* WhatsApp Connection Status */}
      <WhatsAppStatus 
        status={isWhatsAppConnected ? 'connected' : 'disconnected'}
      />

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
          </div>
          <button
            onClick={clearError}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Message and Recipients */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('manual')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors rounded-tl-2xl ${
                  activeTab === 'manual'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Send className="w-4 h-4 inline mr-2" />
                Envío Manual
              </button>
              <button
                onClick={() => setActiveTab('auto')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors rounded-tr-2xl ${
                  activeTab === 'auto'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Clock className="w-4 h-4 inline mr-2" />
                Automatización
              </button>
            </div>

            {/* Manual Send Tab */}
            {activeTab === 'manual' && (
              <div className="p-6 space-y-6">
                {/* Contact Selector */}
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Destinatarios
                  </h3>
                  <ContactSelector
                    contacts={availableContacts}
                    selectedContacts={selectedRecipients}
                    onContactSelect={addRecipient}
                    onContactRemove={removeRecipient}
                    placeholder="Buscar grupos y contactos de WhatsApp..."
                  />
                </div>

                {/* Message Composer */}
                <MessageComposer
                  value={draftMessage}
                  onChange={setDraftMessage}
                  onSend={sendNow}
                  onGenerateDraft={generateDraft}
                  onSaveTemplate={(templateName: string) => saveTemplate({ name: templateName, category: templateFilter })}
                  sending={saving}
                  generating={generatingDraft}
                  placeholder="Escribe el mensaje de recordatorio..."
                  disabled={!isWhatsAppConnected || selectedRecipients.length === 0}
                />

                {/* Schedule Option */}
                <div className="flex items-center gap-4">
                  <input
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={scheduleMessage}
                    disabled={scheduling || !scheduleDateTime || !draftMessage.trim() || selectedRecipients.length === 0}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    {scheduling ? 'Programando...' : 'Programar Envío'}
                  </button>
                </div>
              </div>
            )}

            {/* Automation Tab */}
            {activeTab === 'auto' && (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Enable Automation */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                          Activar Automatización
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Envía mensajes automáticamente cada día
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={config?.enabled || false}
                        onChange={(e) => handleConfigChange('enabled', e.target.checked)}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                    </label>
                  </div>

                  {/* Schedule Time */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                    <label className="block">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">
                        Hora de Envío
                      </h4>
                      <input
                        type="time"
                        value={config?.scheduleTime || '12:00'}
                        onChange={(e) => handleConfigChange('scheduleTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                  </div>
                </div>

                {/* AI Configuration */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
                  <h3 className="font-semibold text-indigo-800 dark:text-indigo-200 text-sm mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Configuración de IA
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Provider Selection */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Proveedor de IA
                      </label>
                      <select
                        value={aiConfig.preferredProvider}
                        onChange={(e) => updateAIConfig({ 
                          preferredProvider: e.target.value as 'gemini' | 'groq' 
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="groq">Groq</option>
                      </select>
                    </div>

                    {/* API Key */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={aiConfig.preferredProvider === 'gemini' ? aiConfig.geminiApiKey : aiConfig.groqApiKey}
                        onChange={(e) => updateAIConfig({
                          [aiConfig.preferredProvider === 'gemini' ? 'geminiApiKey' : 'groqApiKey']: e.target.value
                        })}
                        placeholder={`${aiConfig.preferredProvider.toUpperCase()} API Key`}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Test Connection */}
                  <div className="mt-4 flex items-center justify-between">
                    <button
                      onClick={testAI}
                      disabled={aiTestStatus === 'testing'}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                      {aiTestStatus === 'testing' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                      Probar Conexión
                    </button>

                    {aiTestMessage && (
                      <div className={`text-sm px-3 py-2 rounded-lg ${
                        aiTestStatus === 'error' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {aiTestMessage}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Templates and Info */}
        <div className="space-y-6">
          {/* Templates */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-indigo-600" />
                Plantillas Guardadas
              </h3>
            </div>

            {/* Category Filter */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <select
                value={templateFilter}
                onChange={(e) => setTemplateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {DAYS_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Templates List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredTemplates.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredTemplates.map((template: ReminderTemplate) => (
                    <div
                      key={template.id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                            {template.name}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {template.category}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                            {template.content || template.message || ''}
                          </p>
                        </div>
                        
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => loadTemplate(template)}
                            className="p-1 text-indigo-600 hover:text-indigo-700 transition-colors"
                            title="Cargar plantilla"
                          >
                            <Sparkles className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteTemplate(template.id)}
                            className="p-1 text-red-600 hover:text-red-700 transition-colors"
                            title="Eliminar plantilla"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay plantillas guardadas</p>
                  <p className="text-xs mt-1">Guarda mensajes para reutilizarlos</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="font-bold text-lg mb-4">Estado del Sistema</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-green-100">Conexión WhatsApp</span>
                <span className="flex items-center gap-2">
                  {isWhatsAppConnected ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Activa
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      Inactiva
                    </>
                  )}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-green-100">Automatización</span>
                <span className="flex items-center gap-2">
                  {config?.enabled ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Activa
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      Inactiva
                    </>
                  )}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-green-100">Contactos Disponibles</span>
                <span className="font-bold">{availableContacts.length}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-green-100">Plantillas</span>
                <span className="font-bold">{templates.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
