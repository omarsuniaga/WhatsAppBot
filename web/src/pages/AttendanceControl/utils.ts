import { type Clase, type Contacto } from '../../services/firestore';

export const ATTENDANCE_HELP_DISMISSED_KEY = 'attendance_control_help_dismissed';

export const toLocalISODate = (date: Date = new Date()): string => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
};

export const getWeekdayFromISO = (dateIso: string): number => {
    const d = new Date(dateIso + 'T12:00:00');
    return d.getDay();
};

export const todayISO = (): string => toLocalISODate();

export const isOpaqueId = (value: string | undefined): boolean => {
    if (!value) return false;
    // Simple heuristic for Firestore-like or UUID-like IDs vs human names
    return value.length > 10 && /^[a-zA-Z0-9_-]+$/.test(value);
};

export const readableClassName = (name: string | undefined): string => {
    if (!name) return 'Sin nombre';
    return name.replace(/_/g, ' ').toUpperCase();
};

export const normalizeText = (value: string | undefined | null): string => {
    if (!value) return '';
    return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const normalizePhone = (value: string | undefined | null): string => {
    if (!value) return '';
    return value.replace(/\D/g, '');
};

export const extractPhoneCandidates = (source: any): string[] => {
    if (!source) return [];
    const candidates = new Set<string>();
    const str = JSON.stringify(source);
    // Regex for basic phone matching (10+ digits)
    const matches = str.match(/\d{10,15}/g);
    if (matches) {
        matches.forEach(m => candidates.add(m));
    }
    return Array.from(candidates);
};

export const toJid = (value: string | undefined | null): string | undefined => {
    if (!value) return undefined;
    const clean = normalizePhone(value);
    if (clean.length < 8) return undefined;
    return clean.includes('@s.whatsapp.net') ? clean : `${clean}@s.whatsapp.net`;
};

export const resolveContactoJid = (contact: Contacto | undefined): string | undefined => {
    if (!contact) return undefined;
    return contact.jid || toJid(contact.telefono);
};

export const weekdayNameEs = (dateIso: string): string => {
    const day = getWeekdayFromISO(dateIso);
    const names = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return names[day];
};

export const classHasSessionOnDate = (clase: Clase, dateIso: string): boolean => {
    if (!clase.horario || !Array.isArray(clase.horario)) return false;
    const day = getWeekdayFromISO(dateIso);
    // Firestore day might be 0-6 or string. We assume numeric 0-6 based on weekdayNameEs
    return clase.horario.some((h: any) => {
        const hDay = typeof h.dia === 'string' ? parseInt(h.dia) : h.dia;
        return hDay === day;
    });
};
