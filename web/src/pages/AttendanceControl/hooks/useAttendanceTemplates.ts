import { useState, useCallback, useEffect, useRef } from 'react';
import { dailyReminderApi } from '../../../api/client';
import {
    type AttendanceMessageAction,
    type AttendanceMessageTemplate,
    type AttendanceTemplateAuditEntry
} from '../types';

export const useAttendanceTemplates = (showToast: (type: 'success' | 'error' | 'info', text: string) => void) => {
    const [messageTemplates, setMessageTemplates] = useState<Record<string, AttendanceMessageTemplate>>({});
    const [templateDraft, setTemplateDraft] = useState('');
    const [templateEditorAction, setTemplateEditorAction] = useState<AttendanceMessageAction>('teacher_reminder');
    const [templateSaving, setTemplateSaving] = useState(false);
    const [templateResetting, setTemplateResetting] = useState(false);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templateHistory, setTemplateHistory] = useState<AttendanceTemplateAuditEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Use ref to access current action inside callbacks without creating dependency
    const actionRef = useRef(templateEditorAction);
    actionRef.current = templateEditorAction;

    // Stable showToast ref to avoid dependency churn
    const showToastRef = useRef(showToast);
    showToastRef.current = showToast;

    const loadMessageTemplates = useCallback(async () => {
        setTemplatesLoading(true);
        try {
            const response = await dailyReminderApi.getAttendanceMessageTemplates();
            const data = response.data || {};
            setMessageTemplates(data);
            // Update draft for the current action using ref (no dependency)
            if (data[actionRef.current]) {
                setTemplateDraft(data[actionRef.current].template);
            }
        } catch (error) {
            console.error('Error loading attendance templates:', error);
            showToastRef.current('error', 'No se pudieron cargar las plantillas de mensaje');
        } finally {
            setTemplatesLoading(false);
        }
    }, []); // Stable — no dependencies that change

    const loadTemplateHistory = useCallback(async (action: AttendanceMessageAction) => {
        setHistoryLoading(true);
        try {
            const response = await dailyReminderApi.getAttendanceMessageTemplateHistory({ action, limit: 10 });
            const data = response.data;
            if (Array.isArray(data)) {
                setTemplateHistory(data);
            } else if (data && Array.isArray(data.data)) {
                setTemplateHistory(data.data);
            } else if (data && Array.isArray(data.history)) {
                setTemplateHistory(data.history);
            } else {
                setTemplateHistory([]);
            }
        } catch (error) {
            console.error('Error loading template history:', error);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    // Load templates once on mount
    useEffect(() => {
        loadMessageTemplates();
    }, [loadMessageTemplates]);

    // When the selected action changes, update draft from already-loaded templates and load history
    useEffect(() => {
        if (messageTemplates[templateEditorAction]) {
            setTemplateDraft(messageTemplates[templateEditorAction].template);
        }
        loadTemplateHistory(templateEditorAction);
    }, [templateEditorAction, loadTemplateHistory]);
    // NOTE: intentionally NOT including `messageTemplates` to avoid loop.
    // Draft is updated when action changes or when templates are freshly loaded.

    const saveTemplateConfig = async (missingRequiredVariables: string[]) => {
        const payload = templateDraft.trim();
        if (!payload) {
            showToast('error', 'La plantilla no puede estar vacía');
            return;
        }
        if (missingRequiredVariables.length > 0) {
            showToast('error', `Faltan variables obligatorias: ${missingRequiredVariables.join(', ')}`);
            return;
        }

        setTemplateSaving(true);
        try {
            await dailyReminderApi.updateAttendanceMessageTemplate(templateEditorAction, payload);
            await loadMessageTemplates();
            await loadTemplateHistory(templateEditorAction);
            showToast('success', 'Plantilla actualizada correctamente');
        } catch (error) {
            console.error('Error saving attendance template:', error);
            const message = (error as any)?.response?.data?.error || 'No se pudo guardar la plantilla';
            showToast('error', message);
        } finally {
            setTemplateSaving(false);
        }
    };

    const resetTemplateConfig = async () => {
        setTemplateResetting(true);
        try {
            await dailyReminderApi.resetAttendanceMessageTemplate(templateEditorAction);
            await loadMessageTemplates();
            await loadTemplateHistory(templateEditorAction);
            showToast('success', 'Plantilla restaurada por defecto');
        } catch (error) {
            console.error('Error resetting attendance template:', error);
            const message = (error as any)?.response?.data?.error || 'No se pudo restaurar la plantilla';
            showToast('error', message);
        } finally {
            setTemplateResetting(false);
        }
    };

    const renderMessageTemplate = useCallback((
        action: AttendanceMessageAction,
        variables: Record<string, string | number>
    ): string | null => {
        const template = messageTemplates[action]?.template;
        if (!template) return null;

        return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
            const value = variables[key];
            return value === undefined || value === null ? '' : String(value);
        });
    }, [messageTemplates]);

    return {
        messageTemplates,
        templateDraft,
        setTemplateDraft,
        templateEditorAction,
        setTemplateEditorAction,
        templateSaving,
        templateResetting,
        templatesLoading,
        templateHistory,
        historyLoading,
        saveTemplateConfig,
        resetTemplateConfig,
        renderMessageTemplate,
        loadMessageTemplates
    };
};
