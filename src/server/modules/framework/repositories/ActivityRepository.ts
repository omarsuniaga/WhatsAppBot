/**
 * ActivityRepository - Repositorio para gestionar Actividades
 */

import { BaseRepository } from './BaseRepository';
import { Activity, ActivityType } from '../entities/Activity';

export class ActivityRepository extends BaseRepository<Activity> {
  /**
   * Encuentra actividades por tipo
   */
  async findByType(type: ActivityType): Promise<Activity[]> {
    return this.findByCondition((activity) => activity.type === type);
  }

  /**
   * Encuentra actividades por maestro/director
   */
  async findByLeader(leaderId: string): Promise<Activity[]> {
    return this.findByCondition((activity) => activity.leaderId === leaderId);
  }

  /**
   * Encuentra actividades activas (en curso o futuras)
   */
  async findActive(): Promise<Activity[]> {
    return this.findByCondition((activity) => {
      const now = new Date();
      return activity.startDate <= now && activity.endDate >= now;
    });
  }

  /**
   * Encuentra actividades pasadas
   */
  async findPast(): Promise<Activity[]> {
    return this.findByCondition((activity) => {
      const now = new Date();
      return activity.endDate < now;
    });
  }

  /**
   * Encuentra actividades futuras
   */
  async findUpcoming(): Promise<Activity[]> {
    return this.findByCondition((activity) => {
      const now = new Date();
      return activity.startDate > now;
    });
  }

  /**
   * Encuentra actividades por participante
   */
  async findByParticipant(personId: string): Promise<Activity[]> {
    return this.findByCondition((activity) =>
      activity.participants.some((p) => p === personId)
    );
  }

  /**
   * Encuentra actividades en período específico
   */
  async findByPeriod(startDate: Date, endDate: Date): Promise<Activity[]> {
    return this.findByCondition(
      (activity) =>
        activity.startDate >= startDate &&
        activity.endDate <= endDate
    );
  }

  /**
   * Obtiene estadísticas de actividades
   */
  async getStatistics(): Promise<{
    total: number;
    byType: Record<ActivityType, number>;
    active: number;
    past: number;
    upcoming: number;
    totalParticipants: number;
  }> {
    const all = await this.findAll();
    const active = await this.findActive();
    const past = await this.findPast();
    const upcoming = await this.findUpcoming();

    const byType: Record<ActivityType, number> = {
      [ActivityType.CLASS]: 0,
      [ActivityType.REHEARSAL]: 0,
      [ActivityType.CONCERT]: 0,
      [ActivityType.PARENT_MEETING]: 0,
      [ActivityType.MASTERCLASS]: 0,
      [ActivityType.WORKSHOP]: 0,
      [ActivityType.COMMUNITY_ACTIVITY]: 0,
      [ActivityType.OPEN_REHEARSAL]: 0,
      [ActivityType.INSTITUTIONAL_VISIT]: 0
    };

    let totalParticipants = 0;

    for (const activity of all) {
      byType[activity.type]++;
      totalParticipants += activity.participants.length;
    }

    return {
      total: all.length,
      byType,
      active: active.length,
      past: past.length,
      upcoming: upcoming.length,
      totalParticipants,
    };
  }

  /**
   * Busca actividades por criterios múltiples
   */
  async search(query: {
    type?: ActivityType;
    leaderId?: string;
    status?: 'active' | 'past' | 'upcoming';
    periodStart?: Date;
    periodEnd?: Date;
  }): Promise<Activity[]> {
    let results = await this.findAll();

    if (query.type) {
      results = results.filter((a) => a.type === query.type);
    }

    if (query.leaderId) {
      results = results.filter((a) => a.leaderId === query.leaderId);
    }

    if (query.status) {
      const now = new Date();
      results = results.filter((a) => {
        if (query.status === 'active') return a.startDate <= now && a.endDate >= now;
        if (query.status === 'past') return a.endDate < now;
        if (query.status === 'upcoming') return a.startDate > now;
        return true;
      });
    }

    if (query.periodStart && query.periodEnd) {
      results = results.filter(
        (a) => a.startDate >= query.periodStart! && a.endDate <= query.periodEnd!
      );
    }

    return results;
  }
}

export const activityRepository = new ActivityRepository();
