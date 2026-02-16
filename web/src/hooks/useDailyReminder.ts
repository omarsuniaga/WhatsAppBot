import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { dailyReminderApi, messageApi, aiApi } from '../api/client';

// Types
export interface ReminderConfig {
  enabled: boolean;
  scheduleTime: string;
  targetGroups: string[];
  autoSend: boolean;
}

export interface ReminderTemplate {
  id: string;
  name: string;
  message?: string;
  content?: string;
  category: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Contact {
  id: string;
  name: string;
  jid: string;
  isGroup: boolean;
  avatar?: string;
}

export interface DailyReminderState {
  // Configuration
  config: ReminderConfig | null;
  status: any;
  loading: boolean;
  loadingTemplates: boolean;
  error: string | null;
  saving: boolean;

  // Message Creation
  draftMessage: string;
  generatingDraft: boolean;

  // Recipients
  selectedRecipients: Contact[];
  searchQuery: string;
  searchResults: Contact[];
  showSearchResults: boolean;
  availableContacts: Contact[];

  // AI Configuration
  aiConfig: {
    geminiApiKey: string;
    groqApiKey: string;
    preferredProvider: 'gemini' | 'groq';
    enableFailover: boolean;
  };
  aiTestStatus: 'idle' | 'testing' | 'success' | 'error';
  aiTestMessage: string;

  // Templates
  templates: ReminderTemplate[];
  templateFilter: string;
  showSaveTemplate: boolean;
  templateForm: {
    name: string;
    category: string;
  };

  // Scheduling
  scheduleDateTime: string;
  scheduling: boolean;

  // Computed
  isWhatsAppConnected: boolean;
}

export interface DailyReminderActions {
  // Configuration
  loadConfig: () => Promise<void>;
  saveConfig: (config: ReminderConfig) => Promise<void>;

  // Message Operations
  generateDraft: () => Promise<void>;
  setDraftMessage: (message: string) => void;
  sendNow: () => Promise<void>;

  // Recipients Management
  searchContacts: (query: string) => Promise<void>;
  addRecipient: (contact: Contact) => void;
  removeRecipient: (contactId: string) => void;
  clearRecipients: () => void;

  // AI Configuration
  testAI: () => Promise<void>;
  updateAIConfig: (config: Partial<DailyReminderState['aiConfig']>) => void;

  // Template Management
  loadTemplates: () => Promise<void>;
  saveTemplate: (options?: { name?: string; category?: string }) => Promise<void>;
  setScheduleDateTime: (dateTime: string) => void;
  loadTemplate: (template: ReminderTemplate) => void;
  deleteTemplate: (templateId: string) => Promise<void>;

  // Scheduling
  scheduleMessage: () => Promise<void>;

  // UI Helpers
  clearError: () => void;
  reset: () => void;
}

export const useDailyReminder = (): DailyReminderState & DailyReminderActions => {
  const { connectionStatus, chats } = useStore();

  // State initialization
  const [state, setState] = useState<DailyReminderState>({
    // Configuration
    config: null,
    status: null,
    loading: true,
    loadingTemplates: false,
    error: null,
    saving: false,

    // Message Creation
    draftMessage: '',
    generatingDraft: false,

    // Recipients
    selectedRecipients: [],
    searchQuery: '',
    searchResults: [],
    showSearchResults: false,
    availableContacts: [],

    // AI Configuration
    aiConfig: {
      geminiApiKey: '',
      groqApiKey: '',
      preferredProvider: 'gemini',
      enableFailover: true
    },
    aiTestStatus: 'idle',
    aiTestMessage: '',

    // Templates
    templates: [],
    templateFilter: '',
    showSaveTemplate: false,
    templateForm: {
      name: '',
      category: 'General'
    },

    // Scheduling
    scheduleDateTime: '',
    scheduling: false,

    // Computed
    isWhatsAppConnected: false
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const searchRef = useRef<HTMLDivElement>(null);

  // WhatsApp Connection Status Check
  const isWhatsAppConnected = useMemo(() => {
    return connectionStatus === 'connected';
  }, [connectionStatus]);

  // Available contacts from WhatsApp chats
  const availableContacts = useMemo(() => {
    return chats.map(chat => ({
      id: chat.jid,
      name: chat.displayName || chat.name || chat.jid.split('@')[0],
      jid: chat.jid,
      isGroup: chat.isGroup || chat.jid.includes('@g.us'),
      avatar: chat.profilePicUrl
    }));
  }, [chats]);

  // Update state with available contacts and connection status
  useEffect(() => {
    setState(prev => ({
      ...prev,
      availableContacts,
      isWhatsAppConnected
    }));
  }, [availableContacts, isWhatsAppConnected]);

  // Configuration Actions
  const loadConfig = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const configResponse = await dailyReminderApi.getConfig();
      const statusResponse = await dailyReminderApi.getStatus();

      setState(prev => ({
        ...prev,
        config: configResponse.data.data,
        status: statusResponse.data.data,
        loading: false
      }));
    } catch (error) {
      console.error('Error loading config:', error);
      setState(prev => ({
        ...prev,
        error: 'Error al cargar configuración',
        loading: false
      }));
    }
  }, []);

  const saveConfig = useCallback(async (newConfig: ReminderConfig) => {
    try {
      setState(prev => ({ ...prev, saving: true, error: null }));
      await dailyReminderApi.updateConfig(newConfig);
      setState(prev => ({
        ...prev,
        config: newConfig,
        saving: false
      }));
    } catch (error) {
      console.error('Error saving config:', error);
      setState(prev => ({
        ...prev,
        error: 'Error al guardar configuración',
        saving: false
      }));
    }
  }, []);

  // Message Operations
  const generateDraft = useCallback(async () => {
    if (!isWhatsAppConnected) {
      setState(prev => ({ ...prev, error: 'Debes conectar WhatsApp para generar mensajes' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, generatingDraft: true, error: null }));
      const response = await dailyReminderApi.generateDraft();
      setState(prev => ({
        ...prev,
        draftMessage: response.data.data?.draftMessage || response.data.message, // Fallback just in case
        generatingDraft: false
      }));
    } catch (error) {
      console.error('Error generating draft:', error);
      setState(prev => ({
        ...prev,
        error: 'Error al generar mensaje',
        generatingDraft: false
      }));
    }
  }, [isWhatsAppConnected]);

  const setDraftMessage = useCallback((message: string) => {
    setState(prev => ({ ...prev, draftMessage: message }));
  }, []);

  const sendNow = useCallback(async () => {
    if (!state.draftMessage || state.selectedRecipients.length === 0) {
      setState(prev => ({ ...prev, error: 'Debes escribir un mensaje y seleccionar destinatarios' }));
      return;
    }

    if (!isWhatsAppConnected) {
      setState(prev => ({ ...prev, error: 'Debes conectar WhatsApp para enviar mensajes' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, saving: true, error: null }));

      const recipients = state.selectedRecipients.map(r => r.jid);
      // Send to each recipient individually
      for (const recipient of recipients) {
        await messageApi.sendText(recipient, state.draftMessage);
      }

      setState(prev => ({
        ...prev,
        saving: false,
        draftMessage: '',
        selectedRecipients: []
      }));
    } catch (error) {
      console.error('Error sending message:', error);
      setState(prev => ({
        ...prev,
        error: 'Error al enviar mensaje',
        saving: false
      }));
    }
  }, [state.draftMessage, state.selectedRecipients, isWhatsAppConnected]);

  // Recipients Management
  const searchContacts = useCallback(async (query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));

    if (query.length < 2) {
      setState(prev => ({ ...prev, searchResults: [], showSearchResults: false }));
      return;
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      const filtered = availableContacts.filter(contact =>
        contact.name.toLowerCase().includes(query.toLowerCase()) ||
        contact.jid.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10); // Limit to 10 results

      setState(prev => ({
        ...prev,
        searchResults: filtered,
        showSearchResults: true
      }));
    }, 300);
  }, [availableContacts]);

  const addRecipient = useCallback((contact: Contact) => {
    setState(prev => ({
      ...prev,
      selectedRecipients: prev.selectedRecipients.some(r => r.id === contact.id)
        ? prev.selectedRecipients
        : [...prev.selectedRecipients, contact],
      searchQuery: '',
      searchResults: [],
      showSearchResults: false
    }));
  }, []);

  const removeRecipient = useCallback((contactId: string) => {
    setState(prev => ({
      ...prev,
      selectedRecipients: prev.selectedRecipients.filter(r => r.id !== contactId)
    }));
  }, []);

  const clearRecipients = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedRecipients: []
    }));
  }, []);

  // AI Configuration
  const testAI = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, aiTestStatus: 'testing', aiTestMessage: '' }));

      const config = state.aiConfig.preferredProvider === 'gemini'
        ? { apiKey: state.aiConfig.geminiApiKey, provider: 'gemini' }
        : { apiKey: state.aiConfig.groqApiKey, provider: 'groq' };

      if (!config.apiKey?.trim()) {
        setState(prev => ({
          ...prev,
          aiTestStatus: 'error',
          aiTestMessage: `Debes ingresar la API key de ${state.aiConfig.preferredProvider.toUpperCase()}`
        }));
        return;
      }

      await aiApi.testConfig(config);

      setState(prev => ({
        ...prev,
        aiTestStatus: 'success',
        aiTestMessage: 'Conexión exitosa con ' + state.aiConfig.preferredProvider.toUpperCase()
      }));
    } catch (error: any) {
      const backendMessage = error?.response?.data?.error || error?.response?.data?.rawError || error?.message;
      setState(prev => ({
        ...prev,
        aiTestStatus: 'error',
        aiTestMessage: backendMessage
          ? `Error de conexión con ${state.aiConfig.preferredProvider.toUpperCase()}: ${backendMessage}`
          : 'Error de conexión con ' + state.aiConfig.preferredProvider.toUpperCase()
      }));
    }
  }, [state.aiConfig]);

  const updateAIConfig = useCallback((config: Partial<DailyReminderState['aiConfig']>) => {
    setState(prev => ({
      ...prev,
      aiConfig: { ...prev.aiConfig, ...config }
    }));
  }, []);

  // Template Management
  const loadTemplates = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loadingTemplates: true }));
      const response = await dailyReminderApi.getTemplates();
      setState(prev => ({
        ...prev,
        templates: response.data.data,
        loadingTemplates: false
      }));
    } catch (error) {
      console.error('Error loading templates:', error);
      setState(prev => ({
        ...prev,
        loadingTemplates: false
      }));
    }
  }, []);

  const saveTemplate = useCallback(async (options?: { name?: string; category?: string }) => {
    const templateName = (options?.name || state.templateForm.name || '').trim();
    const templateCategory = options?.category || state.templateForm.category || 'General';
    if (!templateName || !state.draftMessage.trim()) {
      setState(prev => ({ ...prev, error: 'Debes proporcionar nombre y contenido para la plantilla' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, saving: true }));
      await dailyReminderApi.saveTemplate({
        name: templateName,
        content: state.draftMessage,
        category: templateCategory
      });

      setState(prev => ({
        ...prev,
        saving: false,
        showSaveTemplate: false,
        templateForm: { name: '', category: 'General' }
      }));

      await loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      setState(prev => ({
        ...prev,
        error: 'Error al guardar plantilla',
        saving: false
      }));
    }
  }, [state.templateForm, state.draftMessage, loadTemplates]);

  const loadTemplate = useCallback((template: ReminderTemplate) => {
    const templateText = template.content || template.message || '';
    setState(prev => ({
      ...prev,
      draftMessage: templateText,
      templateFilter: template.category
    }));
  }, []);

  const deleteTemplate = useCallback(async (templateId: string) => {
    try {
      await dailyReminderApi.deleteTemplate(templateId);
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      setState(prev => ({ ...prev, error: 'Error al eliminar plantilla' }));
    }
  }, [loadTemplates]);

  // Scheduling
  const scheduleMessage = useCallback(async () => {
    if (!state.draftMessage || state.selectedRecipients.length === 0 || !state.scheduleDateTime) {
      setState(prev => ({ ...prev, error: 'Debes completar todos los campos para programar' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, scheduling: true }));
      const recipients = state.selectedRecipients.map(r => r.jid);

      // Schedule for each recipient individually
      for (const recipient of recipients) {
        await dailyReminderApi.schedule({
          jid: recipient,
          message: state.draftMessage,
          scheduledFor: state.scheduleDateTime
        });
      }

      setState(prev => ({
        ...prev,
        scheduling: false,
        scheduleDateTime: '',
        draftMessage: '',
        selectedRecipients: []
      }));
    } catch (error) {
      console.error('Error scheduling message:', error);
      setState(prev => ({
        ...prev,
        error: 'Error al programar mensaje',
        scheduling: false
      }));
    }
  }, [state.draftMessage, state.selectedRecipients, state.scheduleDateTime]);

  const setScheduleDateTime = useCallback((dateTime: string) => {
    setState(prev => ({ ...prev, scheduleDateTime: dateTime }));
  }, []);

  // UI Helpers
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      // Configuration
      config: null,
      status: null,
      loading: false,
      loadingTemplates: false,
      error: null,
      saving: false,

      // Message Creation
      draftMessage: '',
      generatingDraft: false,

      // Recipients
      selectedRecipients: [],
      searchQuery: '',
      searchResults: [],
      showSearchResults: false,
      availableContacts: [],

      // AI Configuration
      aiConfig: {
        geminiApiKey: '',
        groqApiKey: '',
        preferredProvider: 'gemini',
        enableFailover: true
      },
      aiTestStatus: 'idle',
      aiTestMessage: '',

      // Templates
      templates: [],
      templateFilter: '',
      showSaveTemplate: false,
      templateForm: {
        name: '',
        category: 'General'
      },

      // Scheduling
      scheduleDateTime: '',
      scheduling: false,

      // Computed
      isWhatsAppConnected: false
    });
  }, []);

  // Initialize data
  useEffect(() => {
    loadConfig();
    loadTemplates();

    // Load AI config from localStorage
    const geminiKey = localStorage.getItem('GEMINI_API_KEY') || '';
    const groqKey = localStorage.getItem('GROQ_API_KEY') || '';
    const provider = (localStorage.getItem('PREFERRED_AI_PROVIDER') as 'gemini' | 'groq') || 'gemini';

    setState(prev => ({
      ...prev,
      aiConfig: {
        ...prev.aiConfig,
        geminiApiKey: geminiKey,
        groqApiKey: groqKey,
        preferredProvider: provider
      }
    }));
  }, [loadConfig, loadTemplates]);

  // Click outside handler for search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setState(prev => ({ ...prev, showSearchResults: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return {
    // State
    ...state,

    // Computed
    availableContacts: state.availableContacts,
    isWhatsAppConnected: state.isWhatsAppConnected,

    // Actions
    loadConfig,
    saveConfig,
    generateDraft,
    setDraftMessage,
    sendNow,
    searchContacts,
    addRecipient,
    removeRecipient,
    clearRecipients,
    testAI,
    updateAIConfig,
    loadTemplates,
    saveTemplate,
    setScheduleDateTime,
    loadTemplate,
    deleteTemplate,
    scheduleMessage,
    clearError,
    reset,

  };
};
