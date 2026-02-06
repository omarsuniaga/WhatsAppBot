import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
    baseURL: `${API_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor
api.interceptors.request.use(
    (config) => {
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

// API methods
export const statusApi = {
    getStatus: () => api.get('/status'),
    getQR: () => api.get('/status/qr'),
    logout: () => api.post('/auth/logout'),
};

export const chatApi = {
    getChats: () => api.get('/chats'),
    getMessages: (jid: string, limit = 50) =>
        api.get(`/chats/${encodeURIComponent(jid)}/messages`, { params: { limit } }),
    toggleBot: (jid: string, active: boolean) =>
        api.post(`/chats/${encodeURIComponent(jid)}/bot-toggle`, { active }),
    markAsRead: (jid: string, messageIds?: string[], timestamp?: number) =>
        api.post(`/chats/${encodeURIComponent(jid)}/mark-read`, { messageIds, timestamp }),
};

export const aiApi = {
    updateConfig: (apiKey: string) => 
        api.post('/config/ai', { apiKey }),
};

export const contactApi = {
    getAll: () => api.get('/contacts'),
    search: (query: string) => api.get('/contacts/search', { params: { q: query } }),
    getInfo: (jid: string) => api.get(`/contacts/${encodeURIComponent(jid)}`),
};

// ==========================================
// Knowledge Base API
// ==========================================
export const knowledgeApi = {
    getConfig: () => api.get('/knowledge/config'),
    updateConfig: (config: any) => api.put('/knowledge/config', config),
    
    getCategories: (all?: boolean) => api.get('/knowledge/categories', { params: { all } }),
    addCategory: (category: any) => api.post('/knowledge/categories', category),
    updateCategory: (id: string, category: any) => api.put(`/knowledge/categories/${id}`, category),
    deleteCategory: (id: string) => api.delete(`/knowledge/categories/${id}`),
    
    getFaqs: (params?: { category?: string; approved?: boolean }) => 
        api.get('/knowledge/faqs', { params }),
    getFaq: (id: string) => api.get(`/knowledge/faqs/${id}`),
    addFaq: (faq: any) => api.post('/knowledge/faqs', faq),
    updateFaq: (id: string, faq: any) => api.put(`/knowledge/faqs/${id}`, faq),
    deleteFaq: (id: string) => api.delete(`/knowledge/faqs/${id}`),
    approveFaq: (id: string) => api.post(`/knowledge/faqs/${id}/approve`),
    
    search: (query: string, limit?: number) => 
        api.get('/knowledge/search', { params: { query, limit } }),
    learn: (question: string, answer: string, category?: string) =>
        api.post('/knowledge/learn', { question, answer, category }),
    
    exportData: () => api.get('/knowledge/export'),
    importData: (data: any) => api.post('/knowledge/import', { data }),
    getStats: () => api.get('/knowledge/stats'),
};

// ==========================================
// Escalation API
// ==========================================
export const escalationApi = {
    getConfig: () => api.get('/escalation/config'),
    updateConfig: (config: any) => api.put('/escalation/config', config),
    
    getAdmins: (active?: boolean) => api.get('/escalation/admins', { params: { active } }),
    addAdmin: (admin: any) => api.post('/escalation/admins', admin),
    updateAdmin: (jid: string, admin: any) => api.put(`/escalation/admins/${encodeURIComponent(jid)}`, admin),
    removeAdmin: (jid: string) => api.delete(`/escalation/admins/${encodeURIComponent(jid)}`),
    
    getTickets: (params?: { status?: string; priority?: string; assignedTo?: string }) =>
        api.get('/escalation/tickets', { params }),
    getPendingTickets: () => api.get('/escalation/tickets/pending'),
    getTicket: (id: string) => api.get(`/escalation/tickets/${id}`),
    createTicket: (ticket: any) => api.post('/escalation/tickets', ticket),
    updateTicket: (id: string, ticket: any) => api.put(`/escalation/tickets/${id}`, ticket),
    assignTicket: (id: string, adminJid: string) => 
        api.post(`/escalation/tickets/${id}/assign`, { adminJid }),
    resolveTicket: (id: string, response: string, shouldLearn?: boolean) =>
        api.post(`/escalation/tickets/${id}/resolve`, { response, shouldLearn }),
    closeTicket: (id: string) => api.post(`/escalation/tickets/${id}/close`),
    
    getStats: () => api.get('/escalation/stats'),
};

// ==========================================
// Broadcast API
// ==========================================
export const broadcastApi = {
    getConfig: () => api.get('/broadcast/config'),
    updateConfig: (config: any) => api.put('/broadcast/config', config),
    
    // Contact Lists
    getLists: () => api.get('/broadcast/lists'),
    getList: (id: string) => api.get(`/broadcast/lists/${id}`),
    createList: (list: any) => api.post('/broadcast/lists', list),
    updateList: (id: string, list: any) => api.put(`/broadcast/lists/${id}`, list),
    deleteList: (id: string) => api.delete(`/broadcast/lists/${id}`),
    addContact: (listId: string, contact: any) => 
        api.post(`/broadcast/lists/${listId}/contacts`, contact),
    removeContact: (listId: string, jid: string) =>
        api.delete(`/broadcast/lists/${listId}/contacts/${encodeURIComponent(jid)}`),
    importContacts: (listId: string, contacts: any[]) =>
        api.post(`/broadcast/lists/${listId}/import`, { contacts }),
    
    // Templates
    getTemplates: () => api.get('/broadcast/templates'),
    getTemplate: (id: string) => api.get(`/broadcast/templates/${id}`),
    createTemplate: (template: any) => api.post('/broadcast/templates', template),
    updateTemplate: (id: string, template: any) => api.put(`/broadcast/templates/${id}`, template),
    deleteTemplate: (id: string) => api.delete(`/broadcast/templates/${id}`),
    
    // Campaigns
    getCampaigns: () => api.get('/broadcast/campaigns'),
    getCampaign: (id: string) => api.get(`/broadcast/campaigns/${id}`),
    createCampaign: (campaign: any) => api.post('/broadcast/campaigns', campaign),
    updateCampaign: (id: string, campaign: any) => api.put(`/broadcast/campaigns/${id}`, campaign),
    deleteCampaign: (id: string) => api.delete(`/broadcast/campaigns/${id}`),
    startCampaign: (id: string) => api.post(`/broadcast/campaigns/${id}/start`),
    pauseCampaign: (id: string) => api.post(`/broadcast/campaigns/${id}/pause`),
    getCampaignProgress: (id: string) => api.get(`/broadcast/campaigns/${id}/progress`),
    
    getStats: () => api.get('/broadcast/stats'),
};

// ==========================================
// Message API
// ==========================================
// Helper to create FormData or JSON
const createMessagePayload = (data: Record<string, any>) => {
    const hasFile = Object.values(data).some(value => value instanceof File);
    
    if (hasFile) {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, value);
            }
        });
        return formData;
    }
    
    return data;
};

export const messageApi = {
    sendText: (number: string, message: string) =>
        api.post('/messages/text', { number, message }),

    sendMedia: (number: string, media: File | string, caption?: string) => {
        const payload = createMessagePayload({
            number,
            [media instanceof File ? 'file' : 'mediaUrl']: media,
            caption
        });
        return api.post('/messages/media', payload, {
            headers: media instanceof File ? { 'Content-Type': 'multipart/form-data' } : undefined
        });
    },

    sendFile: (number: string, file: File | string) => {
        const payload = createMessagePayload({
            number,
            [file instanceof File ? 'file' : 'fileUrl']: file
        });
        return api.post('/messages/file', payload, {
            headers: file instanceof File ? { 'Content-Type': 'multipart/form-data' } : undefined
        });
    },

    sendAudio: (number: string, audio: File | string) => {
        const payload = createMessagePayload({
            number,
            [audio instanceof File ? 'file' : 'audioUrl']: audio
        });
        return api.post('/messages/audio', payload, {
            headers: audio instanceof File ? { 'Content-Type': 'multipart/form-data' } : undefined
        });
    },

    sendLocation: (number: string, latitude: string, longitude: string) =>
        api.post('/messages/location', { number, latitude, longitude }),

    sendContact: (number: string, contactNumber: string, displayName: string) =>
        api.post('/messages/contact', { number, contactNumber, displayName }),

    sendPoll: (number: string, question: string, options: string[]) =>
        api.post('/messages/poll', { number, question, options }),

    sendSticker: (number: string, stickerUrl: string, pack?: string, author?: string) =>
        api.post('/messages/sticker', { number, stickerUrl, pack, author }),
};

export const contactGroupApi = {
    getAll: () => api.get('/contact-groups'),
    getGroups: () => api.get('/contact-groups'),
    getByContact: (jid: string) =>
        api.get(`/contact-groups/by-contact/${encodeURIComponent(jid)}`),
    createGroup: (group: { name: string; contacts: Array<{ jid: string; name: string }> }) =>
        api.post('/contact-groups', group),
    deleteGroup: (id: string) => api.delete(`/contact-groups/${id}`),
};

export const configApi = {
    setAiApiKey: (apiKey: string) => api.post('/config/ai', { apiKey }),
    getAiApiKey: () => api.get('/config/ai'),
};

// ==========================================
// Alerts API (Smart Bot Escalations)
// ==========================================
export const alertApi = {
    getAlerts: (status?: 'pending' | 'all') => 
        api.get('/alerts', { params: { status } }),
    getAlert: (id: string) => api.get(`/alerts/${id}`),
    getAlertsByChat: (jid: string) => 
        api.get(`/alerts/chat/${encodeURIComponent(jid)}`),
    respondToAlert: (id: string, response: string, shouldLearn: boolean = true) =>
        api.post(`/alerts/${id}/respond`, { response, shouldLearn }),
    dismissAlert: (id: string, reason?: string) =>
        api.post(`/alerts/${id}/dismiss`, { reason }),
    getStats: () => api.get('/alerts/stats'),
};

// ==========================================
// Bot Assignments API (Per-chat config)
// ==========================================
export const botAssignmentApi = {
    getAll: (activeOnly?: boolean) => 
        api.get('/bot-assignments', { params: { active: activeOnly } }),
    getByJid: (jid: string) => 
        api.get(`/bot-assignments/${encodeURIComponent(jid)}`),
    createOrUpdate: (data: any) => api.post('/bot-assignments', data),
    update: (jid: string, config: any) => 
        api.put(`/bot-assignments/${encodeURIComponent(jid)}`, config),
    toggleBot: (jid: string, enabled: boolean, chatName?: string) =>
        api.post(`/bot-assignments/${encodeURIComponent(jid)}/toggle`, { enabled, chatName }),
    delete: (jid: string) => 
        api.delete(`/bot-assignments/${encodeURIComponent(jid)}`),
    getDefaultConfig: () => api.get('/bot-assignments/default'),
    updateDefaultConfig: (config: any) => api.put('/bot-assignments/default', config),
    getStats: () => api.get('/bot-assignments/stats'),
};

// ==========================================
// Learning API (AI Learning)
// ==========================================
export const learningApi = {
    getAll: (limit?: number) =>
        api.get('/learning', { params: { limit } }),
    getPending: () => api.get('/learning/pending'),
    getById: (id: string) => api.get(`/learning/${id}`),
    approve: (id: string, category?: string) =>
        api.post(`/learning/${id}/approve`, { category }),
    reject: (id: string, reason?: string) =>
        api.post(`/learning/${id}/reject`, { reason }),
    getSettings: () => api.get('/learning/settings'),
    updateSettings: (settings: any) => api.put('/learning/settings', settings),
    getStats: () => api.get('/learning/stats'),
    cleanup: (days?: number) =>
        api.delete('/learning/cleanup', { params: { days } }),
};

// ==========================================
// Triggers API (Bot Activation Keywords)
// ==========================================
export interface Trigger {
    id: string;
    keyword: string;
    matchType: 'exact' | 'contains' | 'startsWith' | 'regex';
    caseSensitive: boolean;
    enabled: boolean;
    description?: string;
    category?: string;
    priority: number;
    createdAt: string;
    updatedAt: string;
}

export const triggerApi = {
    // Config & Control
    getConfig: () => api.get('/triggers/config'),
    toggleListener: (enabled: boolean) =>
        api.post('/triggers/listener/toggle', { enabled }),
    toggleRequireTrigger: (require: boolean) =>
        api.post('/triggers/require/toggle', { require }),
    updateSettings: (settings: any) =>
        api.put('/triggers/settings', { settings }),

    // CRUD
    getAll: (activeOnly?: boolean) =>
        api.get('/triggers', { params: { active: activeOnly } }),
    getById: (id: string) =>
        api.get(`/triggers/${id}`),
    create: (trigger: Omit<Trigger, 'id' | 'createdAt' | 'updatedAt'>) =>
        api.post('/triggers', trigger),
    update: (id: string, updates: Partial<Trigger>) =>
        api.put(`/triggers/${id}`, updates),
    delete: (id: string) =>
        api.delete(`/triggers/${id}`),
    toggle: (id: string) =>
        api.post(`/triggers/${id}/toggle`),

    // Bulk Operations
    enableAll: () => api.post('/triggers/enable-all'),
    disableAll: () => api.post('/triggers/disable-all'),
    importTriggers: (triggers: any[]) =>
        api.post('/triggers/import', { triggers }),
    exportTriggers: () => api.get('/triggers/export'),

    // Stats & Testing
    getStats: () => api.get('/triggers/stats'),
    resetStats: () => api.post('/triggers/stats/reset'),
    testMessage: (message: string) =>
        api.post('/triggers/test', { message }),
};
