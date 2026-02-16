import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { DailyReminderPanel } from '../components/attendance/DailyReminderPanel';

vi.mock('../hooks/useDailyReminder', () => ({
  useDailyReminder: () => ({
    config: { enabled: false, scheduleTime: '12:00', targetGroups: [], autoSend: false },
    loading: false,
    loadingTemplates: false,
    error: null,
    draftMessage: '',
    selectedRecipients: [],
    availableContacts: [
      { id: '1', name: 'Grupo Test', jid: 'test@g.us', isGroup: true },
      { id: '2', name: 'Contacto Test', jid: 'test@s.whatsapp.net', isGroup: false },
    ],
    isWhatsAppConnected: false,
    generatingDraft: false,
    saving: false,
    scheduling: false,
    scheduleDateTime: '',
    aiTestStatus: 'idle',
    aiTestMessage: '',
    aiConfig: {
      geminiApiKey: '',
      groqApiKey: '',
      preferredProvider: 'gemini',
      enableFailover: true,
    },
    templates: [],

    generateDraft: vi.fn(),
    setDraftMessage: vi.fn(),
    sendNow: vi.fn(),
    addRecipient: vi.fn(),
    removeRecipient: vi.fn(),
    testAI: vi.fn(),
    updateAIConfig: vi.fn(),
    saveTemplate: vi.fn(),
    scheduleMessage: vi.fn(),
    setScheduleDateTime: vi.fn(),
    loadTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    clearError: vi.fn(),
    saveConfig: vi.fn(),
  }),
}));

describe('DailyReminderPanel', () => {
  test('renderiza el titulo principal', () => {
    render(<DailyReminderPanel />);
    expect(screen.getByText('Recordatorios Diarios')).toBeInTheDocument();
  });

  test('muestra el estado de conexion WhatsApp', () => {
    render(<DailyReminderPanel />);
    expect(screen.getByText(/Desconectado/i)).toBeInTheDocument();
  });

  test('muestra pestanas de envio manual y automatizacion', () => {
    render(<DailyReminderPanel />);
    expect(screen.getByRole('button', { name: /Env[ií]o Manual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Automatizaci[oó]n/i })).toBeInTheDocument();
  });

  test('renderiza selector de contactos y compositor', () => {
    render(<DailyReminderPanel />);
    expect(screen.getByPlaceholderText(/Buscar grupos y contactos de WhatsApp/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Escribe el mensaje de recordatorio/i)).toBeInTheDocument();
  });

  test('muestra panel de plantillas y estado del sistema', () => {
    render(<DailyReminderPanel />);
    expect(screen.getByRole('heading', { name: /Plantillas Guardadas/i })).toBeInTheDocument();
    expect(screen.getByText(/Estado del Sistema/i)).toBeInTheDocument();
    expect(screen.getAllByText(/WhatsApp/i).length).toBeGreaterThan(0);
  });
});
