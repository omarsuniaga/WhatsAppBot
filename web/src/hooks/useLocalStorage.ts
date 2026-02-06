import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para manejar estado persistido en localStorage
 * @param key - Clave para localStorage
 * @param initialValue - Valor inicial si no existe en localStorage
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
    // Obtener valor inicial desde localStorage o usar el valor por defecto
    const readValue = useCallback((): T => {
        if (typeof window === 'undefined') {
            return initialValue;
        }

        try {
            const item = window.localStorage.getItem(key);
            return item ? (JSON.parse(item) as T) : initialValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    }, [key, initialValue]);

    const [storedValue, setStoredValue] = useState<T>(readValue);

    // Función para actualizar el valor
    const setValue = useCallback((value: T | ((prev: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
                // Disparar evento para sincronizar entre tabs
                window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(valueToStore) }));
            }
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    // Escuchar cambios en localStorage (para sincronización entre tabs)
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key && e.newValue !== null) {
                try {
                    setStoredValue(JSON.parse(e.newValue));
                } catch {
                    console.warn(`Error parsing localStorage value for key "${key}"`);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [key]);

    return [storedValue, setValue];
}

// Constantes para las claves de localStorage
export const STORAGE_KEYS = {
    // Configuraciones del sistema
    KNOWLEDGE_CONFIG: 'whatsapp_bot_knowledge_config',
    ESCALATION_CONFIG: 'whatsapp_bot_escalation_config',
    BROADCAST_CONFIG: 'whatsapp_bot_broadcast_config',
    
    // Estado de la UI
    ADMIN_ACTIVE_PANEL: 'whatsapp_bot_admin_panel',
    SIDEBAR_COLLAPSED: 'whatsapp_bot_sidebar_collapsed',
    
    // Otros
    GEMINI_API_KEY: 'GEMINI_API_KEY',
    THEME: 'whatsapp_bot_theme',
} as const;

// Tipos para las configuraciones
export interface KnowledgeConfig {
    businessName: string;
    businessDescription: string;
    toneStyle: string;
    minConfidenceToRespond: number;
    minConfidenceToConfirm: number;
    enableAutoLearn: boolean;
}

export interface EscalationConfig {
    autoAssign: boolean;
    reminderInterval: number;
    maxTicketsPerAdmin: number;
}

export interface BroadcastConfig {
    messageDelay: number;
    randomizeDelay: boolean;
    startHour: string;
    endHour: string;
}

// Valores por defecto para las configuraciones
export const DEFAULT_CONFIGS: {
    knowledge: KnowledgeConfig;
    escalation: EscalationConfig;
    broadcast: BroadcastConfig;
} = {
    knowledge: {
        businessName: 'Mi Negocio',
        businessDescription: '',
        toneStyle: 'professional',
        minConfidenceToRespond: 0.85,
        minConfidenceToConfirm: 0.50,
        enableAutoLearn: false
    },
    escalation: {
        autoAssign: true,
        reminderInterval: 15,
        maxTicketsPerAdmin: 10
    },
    broadcast: {
        messageDelay: 3000,
        randomizeDelay: true,
        startHour: '08:00',
        endHour: '20:00'
    }
};
