/**
 * Domain layer — Appointment (Fase C of docs/SPEC_CONVERSACION_GUIADA.md, section 6)
 *
 * An Appointment is always created as a *proposal* — the bot never
 * confirms one on its own (spec section 6 and 10: human confirmation is
 * mandatory). Pure business logic only — no filesystem, no Express.
 */

export type AppointmentStatus = 'propuesta' | 'confirmada' | 'cancelada' | 'reagendada';

export interface Appointment {
    id: string;
    chatJid: string;
    contactName: string;
    type: string;
    proposedDate?: string;
    status: AppointmentStatus;
    sourceFlowId: string;
    createdAt: string;
    updatedAt: string;
    confirmedBy?: string;
    notes?: string;
}

const MAX_NOTES_LENGTH = 1000;
const MAX_NAME_LENGTH = 100;
const MAX_TYPE_LENGTH = 60;

export function sanitizeContactName(name: string): string {
    if (!name || typeof name !== 'string') return 'Contacto';
    return name.trim().replace(/[<>"'&]/g, '').slice(0, MAX_NAME_LENGTH) || 'Contacto';
}

/**
 * Every Appointment starts as a proposal generated from a guided flow's
 * accumulated entities (typically `tipoEvento` and `fecha`, spec section 6).
 * Never call this to create an already-confirmed appointment.
 */
export function createProposedAppointment(
    chatJid: string,
    contactName: string,
    type: string,
    proposedDate: string | undefined,
    sourceFlowId: string,
    now: string = new Date().toISOString()
): Appointment {
    return {
        id: `appt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        chatJid,
        contactName: sanitizeContactName(contactName),
        type: (type || 'general').trim().slice(0, MAX_TYPE_LENGTH),
        proposedDate,
        status: 'propuesta',
        sourceFlowId,
        createdAt: now,
        updatedAt: now
    };
}

/**
 * Only a human confirms an appointment (dashboard action) — the bot never
 * calls this on its own.
 */
export function confirmAppointment(
    appointment: Appointment,
    confirmedBy: string,
    now: string = new Date().toISOString()
): Appointment {
    appointment.status = 'confirmada';
    appointment.confirmedBy = confirmedBy;
    appointment.updatedAt = now;
    return appointment;
}

export function cancelAppointment(
    appointment: Appointment,
    notes: string | undefined,
    now: string = new Date().toISOString()
): Appointment {
    appointment.status = 'cancelada';
    if (notes) {
        appointment.notes = notes.trim().slice(0, MAX_NOTES_LENGTH);
    }
    appointment.updatedAt = now;
    return appointment;
}

export function rescheduleAppointment(
    appointment: Appointment,
    newDate: string,
    now: string = new Date().toISOString()
): Appointment {
    appointment.status = 'reagendada';
    appointment.proposedDate = newDate;
    appointment.updatedAt = now;
    return appointment;
}
