/**
 * EventBusService - Event Management System
 * Permite comunicación entre servicios sin acoplamiento
 */

type EventListener<T = any> = (data: T) => Promise<void> | void;

export interface FrameworkEvent<T = any> {
  type: string;
  data: T;
  timestamp: Date;
  source: string;
}

export enum FrameworkEventType {
  // Student Events
  STUDENT_ENROLLED = 'STUDENT_ENROLLED',
  STUDENT_AT_RISK = 'STUDENT_AT_RISK',
  STUDENT_GRADUATED = 'STUDENT_GRADUATED',
  STUDENT_DROPPED = 'STUDENT_DROPPED',

  // Attendance Events
  ATTENDANCE_RECORDED = 'ATTENDANCE_RECORDED',
  ATTENDANCE_PATTERN_CHANGED = 'ATTENDANCE_PATTERN_CHANGED',

  // Evaluation Events
  EVALUATION_COMPLETED = 'EVALUATION_COMPLETED',
  EVALUATION_FAILED = 'EVALUATION_FAILED',

  // Activity Events
  ACTIVITY_CREATED = 'ACTIVITY_CREATED',
  ACTIVITY_STARTED = 'ACTIVITY_STARTED',
  ACTIVITY_COMPLETED = 'ACTIVITY_COMPLETED',
  PARTICIPATION_RECORDED = 'PARTICIPATION_RECORDED',

  // Indicator Events
  INDICATOR_CALCULATED = 'INDICATOR_CALCULATED',
  INDICATOR_ALERT = 'INDICATOR_ALERT',

  // Instrument Events
  INSTRUMENT_ASSIGNED = 'INSTRUMENT_ASSIGNED',
  INSTRUMENT_MAINTENANCE_DUE = 'INSTRUMENT_MAINTENANCE_DUE',

  // System Events
  KPI_BATCH_COMPLETED = 'KPI_BATCH_COMPLETED',
  ALERT_GENERATED = 'ALERT_GENERATED',
  SYNC_COMPLETED = 'SYNC_COMPLETED',
}

export class EventBusService {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private eventHistory: FrameworkEvent[] = [];
  private maxHistorySize: number = 1000;

  /**
   * Registra un listener para un tipo de evento
   */
  on<T = any>(
    eventType: string | FrameworkEventType,
    listener: EventListener<T>
  ): () => void {
    const typeStr = String(eventType);

    if (!this.listeners.has(typeStr)) {
      this.listeners.set(typeStr, new Set());
    }

    this.listeners.get(typeStr)!.add(listener);

    // Retornar función para desuscribirse
    return () => {
      this.listeners.get(typeStr)?.delete(listener);
    };
  }

  /**
   * Registra un listener de una sola ejecución
   */
  once<T = any>(
    eventType: string | FrameworkEventType,
    listener: EventListener<T>
  ): () => void {
    const typeStr = String(eventType);
    const onceWrapper = async (data: T) => {
      await listener(data);
      unsubscribe();
    };

    const unsubscribe = this.on(typeStr, onceWrapper);
    return unsubscribe;
  }

  /**
   * Emite un evento de forma síncrona
   */
  emit<T = any>(
    eventType: string | FrameworkEventType,
    data: T,
    source: string = 'system'
  ): void {
    const typeStr = String(eventType);
    const event: FrameworkEvent<T> = {
      type: typeStr,
      data,
      timestamp: new Date(),
      source,
    };

    // Agregar al historial
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Ejecutar listeners
    const listeners = this.listeners.get(typeStr) || new Set();
    for (const listener of listeners) {
      try {
        const result = listener(data);
        if (result instanceof Promise) {
          result.catch((err) =>
            console.error(`Error en listener para evento ${typeStr}:`, err)
          );
        }
      } catch (err) {
        console.error(`Error ejecutando listener para evento ${typeStr}:`, err);
      }
    }
  }

  /**
   * Emite un evento de forma asíncrona
   */
  async emitAsync<T = any>(
    eventType: string | FrameworkEventType,
    data: T,
    source: string = 'system'
  ): Promise<void> {
    const typeStr = String(eventType);
    const event: FrameworkEvent<T> = {
      type: typeStr,
      data,
      timestamp: new Date(),
      source,
    };

    // Agregar al historial
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Ejecutar listeners de forma paralela
    const listeners = this.listeners.get(typeStr) || new Set();
    const promises: Promise<void>[] = [];

    for (const listener of listeners) {
      try {
        const result = listener(data);
        if (result instanceof Promise) {
          promises.push(result.catch((err) =>
            console.error(`Error en listener para evento ${typeStr}:`, err)
          ));
        }
      } catch (err) {
        console.error(`Error ejecutando listener para evento ${typeStr}:`, err);
      }
    }

    await Promise.all(promises);
  }

  /**
   * Obtiene el historial de eventos
   */
  getHistory(filter?: {
    type?: string;
    source?: string;
    since?: Date;
  }): FrameworkEvent[] {
    let result = [...this.eventHistory];

    if (filter?.type) {
      result = result.filter((e) => e.type === filter.type);
    }

    if (filter?.source) {
      result = result.filter((e) => e.source === filter.source);
    }

    if (filter?.since) {
      result = result.filter((e) => e.timestamp >= filter.since!);
    }

    return result;
  }

  /**
   * Obtiene los últimos N eventos
   */
  getRecentEvents(limit: number = 50): FrameworkEvent[] {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Limpia el historial
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Obtiene conteo de listeners registrados
   */
  getListenerCount(eventType?: string | FrameworkEventType): number {
    if (eventType) {
      return this.listeners.get(String(eventType))?.size || 0;
    }

    let total = 0;
    for (const listeners of this.listeners.values()) {
      total += listeners.size;
    }
    return total;
  }

  /**
   * Remueve todos los listeners de un tipo de evento
   */
  removeAllListeners(eventType?: string | FrameworkEventType): void {
    if (eventType) {
      const typeStr = String(eventType);
      this.listeners.delete(typeStr);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Obtiene estadísticas del bus de eventos
   */
  getStatistics(): {
    totalListeners: number;
    eventTypesRegistered: number;
    historySize: number;
    listenersByType: Record<string, number>;
  } {
    const listenersByType: Record<string, number> = {};
    let totalListeners = 0;

    for (const [type, listeners] of this.listeners.entries()) {
      listenersByType[type] = listeners.size;
      totalListeners += listeners.size;
    }

    return {
      totalListeners,
      eventTypesRegistered: this.listeners.size,
      historySize: this.eventHistory.length,
      listenersByType,
    };
  }
}

export const eventBusService = new EventBusService();
