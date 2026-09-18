/**
 * Driven adapter — Appointment persisted as JSON (data/appointments.json,
 * per spec section 8).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { Appointment } from '../domain/Appointment';
import type { AppointmentRepository } from '../domain/ports';

interface AppointmentData {
    version: number;
    appointments: Record<string, Appointment>;
}

const DATA_PATH = join(process.cwd(), 'data', 'appointments.json');

export class JsonAppointmentRepository implements AppointmentRepository {
    private data: AppointmentData;

    constructor() {
        this.data = this.load();
    }

    private load(): AppointmentData {
        try {
            if (existsSync(DATA_PATH)) {
                return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
            }
        } catch (error) {
            console.error('[JsonAppointmentRepository] Error loading data:', error);
        }

        return { version: 1, appointments: {} };
    }

    private persist(): void {
        try {
            const dir = dirname(DATA_PATH);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(DATA_PATH, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('[JsonAppointmentRepository] Error saving data:', error);
        }
    }

    findAll(): Appointment[] {
        return Object.values(this.data.appointments).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    findById(id: string): Appointment | null {
        return this.data.appointments[id] || null;
    }

    findByChat(chatJid: string): Appointment[] {
        return Object.values(this.data.appointments).filter(a => a.chatJid === chatJid);
    }

    save(appointment: Appointment): void {
        this.data.appointments[appointment.id] = appointment;
        this.persist();
    }
}
