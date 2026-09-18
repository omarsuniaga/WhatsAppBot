import type { Appointment } from './Appointment';

export interface AppointmentRepository {
    findAll(): Appointment[];
    findById(id: string): Appointment | null;
    findByChat(chatJid: string): Appointment[];
    save(appointment: Appointment): void;
}
