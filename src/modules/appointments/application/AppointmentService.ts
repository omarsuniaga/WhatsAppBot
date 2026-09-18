/**
 * Application layer — use cases for the appointments module (Fase C).
 * Depends only on the AppointmentRepository port.
 */
import { EventEmitter } from 'events';
import {
    Appointment,
    createProposedAppointment,
    confirmAppointment,
    cancelAppointment,
    rescheduleAppointment
} from '../domain/Appointment';
import { AppointmentRepository } from '../domain/ports';
import { JsonAppointmentRepository } from '../infrastructure/JsonAppointmentRepository';

class AppointmentService extends EventEmitter {
    private static instance: AppointmentService;

    constructor(private readonly repository: AppointmentRepository) {
        super();
    }

    static getInstance(): AppointmentService {
        if (!AppointmentService.instance) {
            AppointmentService.instance = new AppointmentService(new JsonAppointmentRepository());
        }
        return AppointmentService.instance;
    }

    /**
     * Called from BotOrchestrator when a guided flow's successCondition is
     * met (spec section 6). Always creates a *proposal* — never a confirmed
     * appointment.
     */
    createFromFlowSuccess(
        chatJid: string,
        contactName: string,
        accumulatedEntities: Record<string, string>,
        sourceFlowId: string
    ): Appointment {
        const type = accumulatedEntities.tipoEvento || 'general';
        const proposedDate = accumulatedEntities.fecha;

        const appointment = createProposedAppointment(chatJid, contactName, type, proposedDate, sourceFlowId);
        this.repository.save(appointment);
        this.emit('appointment:proposed', appointment);
        return appointment;
    }

    getAll(): Appointment[] {
        return this.repository.findAll();
    }

    getById(id: string): Appointment | null {
        return this.repository.findById(id);
    }

    getByChat(chatJid: string): Appointment[] {
        return this.repository.findByChat(chatJid);
    }

    confirm(id: string, confirmedBy: string): Appointment | null {
        const appointment = this.repository.findById(id);
        if (!appointment) return null;

        confirmAppointment(appointment, confirmedBy);
        this.repository.save(appointment);
        this.emit('appointment:confirmed', appointment);
        return appointment;
    }

    cancel(id: string, notes?: string): Appointment | null {
        const appointment = this.repository.findById(id);
        if (!appointment) return null;

        cancelAppointment(appointment, notes);
        this.repository.save(appointment);
        this.emit('appointment:cancelled', appointment);
        return appointment;
    }

    reschedule(id: string, newDate: string): Appointment | null {
        const appointment = this.repository.findById(id);
        if (!appointment) return null;

        rescheduleAppointment(appointment, newDate);
        this.repository.save(appointment);
        this.emit('appointment:rescheduled', appointment);
        return appointment;
    }
}

export default AppointmentService;
export type { Appointment, AppointmentStatus } from '../domain/Appointment';
