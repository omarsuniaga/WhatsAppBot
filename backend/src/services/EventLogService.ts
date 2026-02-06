/**
 * EventLogService - Event logging wrapper
 * 
 * Domain service for audit logging. Uses EventLogRepo for persistence.
 * No HTTP/UI dependencies.
 */

import { EventEmitter } from 'events';
import { EventLog } from '../domain/types';
import { EventLogType, EventLogLevel } from '../domain/enums';
import { EventLogRepo } from '../repos';

export class EventLogService extends EventEmitter {
    private static instance: EventLogService;
    private eventLogRepo = EventLogRepo.getInstance();

    private constructor() {
        super();
    }

    public static getInstance(): EventLogService {
        if (!EventLogService.instance) {
            EventLogService.instance = new EventLogService();
        }
        return EventLogService.instance;
    }

    /**
     * Logs an event to the event stream.
     * @param type - The type of event.
     * @param payload - The data associated with the event.
     * @param actor - The ID of the user or system that triggered the event.
     * @param level - The log level (default: info).
     * @param message - A descriptive message.
     * @returns The created event log entry.
     */
    async logEvent(
        type: EventLogType,
        payload: Record<string, unknown>,
        actor?: string,
        level: EventLogLevel = EventLogLevel.Info,
        message: string = ''
    ): Promise<EventLog> {
        const finalMessage = message || `Event of type ${type} occurred.`;
        
        // Determine actor type
        let actorType: 'user' | 'system' | 'bot' = 'system';
        if (actor) {
            if (actor.startsWith('st_') || actor.startsWith('ct_')) {
                actorType = 'user';
            } else if (actor.startsWith('bot_')) {
                actorType = 'bot';
            }
        }

        const event = await this.eventLogRepo.log(
            type,
            level,
            finalMessage,
            {
                data: payload,
                actorId: actor,
                actorType
            }
        );

        this.emit('event:logged', event);
        return event;
    }

    /**
     * Get recent events
     */
    async getRecentEvents(limit: number = 100): Promise<EventLog[]> {
        return this.eventLogRepo.findRecent(limit);
    }

    /**
     * Get events by type
     */
    async getEventsByType(type: EventLogType): Promise<EventLog[]> {
        return this.eventLogRepo.findByType(type);
    }

    /**
     * Get error events
     */
    async getErrors(): Promise<EventLog[]> {
        return this.eventLogRepo.findErrors();
    }
}

export default EventLogService;
