/**
 * Entity: Activity
 * Actividades educativas y artísticas
 */

export enum ActivityType {
  CLASS = 'class',
  WORKSHOP = 'workshop',
  REHEARSAL = 'rehearsal',
  CONCERT = 'concert',
  MASTERCLASS = 'masterclass',
  PARENT_MEETING = 'parent_meeting',
  COMMUNITY_ACTIVITY = 'community_activity',
  OPEN_REHEARSAL = 'open_rehearsal',
  INSTITUTIONAL_VISIT = 'institutional_visit'
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  durationMinutes: number;
  leaderId: string;
  participants: string[];
  groupIds?: string[];
  location: string;
  repeatable: boolean;
  status: 'scheduled' | 'completed' | 'cancelled';
  evidenceUrls?: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  source: 'manual' | 'imported' | 'automatic';
}

export class ActivityFactory {
  static create(data: Partial<Activity>, createdBy: string): Activity {
    const start = data.startDate || new Date();
    const end = data.endDate || new Date(start.getTime() + 60 * 60 * 1000);
    const duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

    return {
      id: `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: data.type || ActivityType.CLASS,
      title: data.title || '',
      description: data.description,
      startDate: start,
      endDate: end,
      durationMinutes: duration,
      leaderId: data.leaderId || '',
      participants: data.participants || [],
      groupIds: data.groupIds || [],
      location: data.location || '',
      repeatable: data.repeatable || false,
      status: data.status || 'scheduled',
      evidenceUrls: data.evidenceUrls || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      source: data.source || 'manual'
    };
  }

  static hasStarted(activity: Activity): boolean {
    return new Date() >= activity.startDate;
  }

  static isInProgress(activity: Activity): boolean {
    const now = new Date();
    return now >= activity.startDate && now <= activity.endDate;
  }

  static hasEnded(activity: Activity): boolean {
    return new Date() > activity.endDate;
  }

  static addParticipant(activity: Activity, personId: string): void {
    if (!activity.participants.includes(personId)) {
      activity.participants.push(personId);
    }
  }

  static removeParticipant(activity: Activity, personId: string): void {
    activity.participants = activity.participants.filter(id => id !== personId);
  }

  static hasParticipant(activity: Activity, personId: string): boolean {
    return activity.participants.includes(personId);
  }
}
