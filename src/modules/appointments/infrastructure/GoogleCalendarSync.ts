/**
 * Driving/driven adapter — Google Calendar synchronization (ADR-002,
 * docs/adrs/ADR-002-integracion-calendario-externo.md).
 *
 * Uni-directional: bot -> Google Calendar only. Subscribes to
 * AppointmentService's existing events and mirrors confirmed/cancelled/
 * rescheduled appointments as calendar events. Never touches domain or
 * application logic, and never lets a Google API failure block a
 * confirm/cancel/reschedule action from the dashboard — every call here
 * is best-effort and only logs on failure.
 *
 * A `propuesta` never reaches Google Calendar: only `appointment:confirmed`
 * creates an event, so the operator's calendar never fills up with
 * appointments a customer hasn't actually confirmed yet.
 */
import { google, calendar_v3 } from 'googleapis';
import { existsSync } from 'fs';
import AppointmentService, { Appointment } from '../application/AppointmentService';

interface GoogleCalendarSyncOptions {
    credentialsPath: string;
    calendarId: string;
}

export class GoogleCalendarSync {
    private calendar: calendar_v3.Calendar | null = null;

    constructor(
        private readonly appointmentService: AppointmentService,
        private readonly options: GoogleCalendarSyncOptions
    ) {}

    /** Wires the listeners. Call once at startup, gated by GOOGLE_CALENDAR_ENABLED. */
    start(): void {
        if (!existsSync(this.options.credentialsPath)) {
            console.error(
                `[GoogleCalendarSync] Credentials file not found at ${this.options.credentialsPath}; sync disabled.`
            );
            return;
        }

        try {
            const auth = new google.auth.GoogleAuth({
                keyFile: this.options.credentialsPath,
                scopes: ['https://www.googleapis.com/auth/calendar.events']
            });
            this.calendar = google.calendar({ version: 'v3', auth });
        } catch (error) {
            console.error('[GoogleCalendarSync] Failed to initialize Google Calendar client:', error);
            return;
        }

        this.appointmentService.on('appointment:confirmed', (appointment: Appointment) => {
            this.createEvent(appointment).catch(error =>
                console.error(`[GoogleCalendarSync] Failed to create event for ${appointment.id}:`, error)
            );
        });

        this.appointmentService.on('appointment:rescheduled', (appointment: Appointment) => {
            this.updateEvent(appointment).catch(error =>
                console.error(`[GoogleCalendarSync] Failed to update event for ${appointment.id}:`, error)
            );
        });

        this.appointmentService.on('appointment:cancelled', (appointment: Appointment) => {
            this.deleteEvent(appointment).catch(error =>
                console.error(`[GoogleCalendarSync] Failed to delete event for ${appointment.id}:`, error)
            );
        });

        console.log('[GoogleCalendarSync] Listening for appointment confirm/cancel/reschedule events');
    }

    private buildEventBody(appointment: Appointment): calendar_v3.Schema$Event {
        const date = this.parseAppointmentDate(appointment.proposedDate);

        return {
            summary: `${appointment.type} — ${appointment.contactName}`,
            description: [
                `Contacto: ${appointment.contactName}`,
                `Chat: ${appointment.chatJid}`,
                `Origen: flujo guiado "${appointment.sourceFlowId}"`,
                appointment.notes ? `Notas: ${appointment.notes}` : null
            ].filter(Boolean).join('\n'),
            // No hay hora de fin capturada por el flujo guiado todavía; se
            // usa un evento de un día como aproximación razonable (ADR-002).
            start: date ? { date } : undefined,
            end: date ? { date } : undefined
        };
    }

    /**
     * The flow's captured `fecha` entity is free-form text (spec section 5
     * lets the bot capture whatever the customer typed), so this best-effort
     * parses common formats and falls back to `undefined` (no date on the
     * event) rather than guessing wrong.
     */
    private parseAppointmentDate(proposedDate?: string): string | undefined {
        if (!proposedDate) return undefined;

        const isoMatch = proposedDate.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) return isoMatch[0];

        const dmyMatch = proposedDate.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
        if (dmyMatch) {
            const [, day, month, year] = dmyMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        return undefined;
    }

    private async createEvent(appointment: Appointment): Promise<void> {
        if (!this.calendar) return;
        if (appointment.googleEventId) return; // already synced

        const response = await this.calendar.events.insert({
            calendarId: this.options.calendarId,
            requestBody: this.buildEventBody(appointment)
        });

        const eventId = response.data.id;
        if (eventId) {
            this.appointmentService.setGoogleEventId(appointment.id, eventId);
        }
    }

    private async updateEvent(appointment: Appointment): Promise<void> {
        if (!this.calendar) return;

        if (!appointment.googleEventId) {
            // Never synced (e.g. rescheduled before being confirmed once) —
            // nothing to update.
            return;
        }

        await this.calendar.events.patch({
            calendarId: this.options.calendarId,
            eventId: appointment.googleEventId,
            requestBody: this.buildEventBody(appointment)
        });
    }

    private async deleteEvent(appointment: Appointment): Promise<void> {
        if (!this.calendar) return;
        if (!appointment.googleEventId) return;

        await this.calendar.events.delete({
            calendarId: this.options.calendarId,
            eventId: appointment.googleEventId
        });

        this.appointmentService.setGoogleEventId(appointment.id, undefined);
    }
}

/**
 * Composition helper for the server bootstrap (src/server/index.ts).
 * No-op unless GOOGLE_CALENDAR_ENABLED=true, so the rest of the system
 * behaves exactly as before this adapter existed when it's not configured.
 */
export function initGoogleCalendarSync(): GoogleCalendarSync | null {
    if (process.env.GOOGLE_CALENDAR_ENABLED !== 'true') {
        return null;
    }

    const credentialsPath = process.env.GOOGLE_CALENDAR_CREDENTIALS_PATH || './secrets/google-calendar-sa.json';
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    const sync = new GoogleCalendarSync(AppointmentService.getInstance(), { credentialsPath, calendarId });
    sync.start();
    return sync;
}
