/**
 * Entity: CommunicationAction
 * Acciones de comunicación y difusión
 */

export enum CommunicationChannel {
  SOCIAL_MEDIA = 'social_media',
  RADIO = 'radio',
  TV = 'tv',
  PRESS = 'press',
  WEBSITE = 'website',
  WHATSAPP = 'whatsapp',
  EMAIL = 'email'
}

export interface CommunicationAction {
  id: string;
  groupId: string;
  channel: CommunicationChannel;
  title: string;
  description?: string;
  url?: string;
  reference?: string;
  date: Date; // publicationDate
  estimatedReach?: number;
  actualReach?: number;
  relatedActivityIds?: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export class CommunicationFactory {
  static create(
    groupId: string,
    data: Partial<CommunicationAction>,
    createdBy: string
  ): CommunicationAction {
    return {
      id: `COM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      groupId,
      channel: data.channel || CommunicationChannel.SOCIAL_MEDIA,
      title: data.title || '',
      description: data.description,
      url: data.url,
      reference: data.reference,
      date: data.date || new Date(),
      estimatedReach: data.estimatedReach,
      actualReach: data.actualReach,
      relatedActivityIds: data.relatedActivityIds || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy
    };
  }

  static reachPercentage(communication: CommunicationAction): number {
    if (!communication.estimatedReach || communication.estimatedReach === 0) return 0;
    return ((communication.actualReach || 0) / communication.estimatedReach) * 100;
  }

  static isRecent(communication: CommunicationAction, dayThreshold: number = 7): boolean {
    const now = new Date();
    const daysPassed =
      (now.getTime() - communication.date.getTime()) / (1000 * 60 * 60 * 24);
    return daysPassed < dayThreshold;
  }
}

export interface Group {
  id: string;
  name: string;
  type: string;
  description?: string;
  directorId: string;
  members: string[];
  capacity: number;
  status: 'active' | 'inactive' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export class GroupFactory {
  static create(data: Partial<Group>, createdBy: string): Group {
    return {
      id: `GRP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: data.name || '',
      type: data.type || 'ensemble',
      description: data.description,
      directorId: data.directorId || '',
      members: data.members || [],
      capacity: data.capacity || 30,
      status: data.status || 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy
    };
  }

  static getMemberCount(group: Group): number {
    return group.members.length;
  }

  static hasSpace(group: Group): boolean {
    return GroupFactory.getMemberCount(group) < group.capacity;
  }

  static addMember(group: Group, studentId: string): boolean {
    if (GroupFactory.hasSpace(group) && !group.members.includes(studentId)) {
      group.members.push(studentId);
      return true;
    }
    return false;
  }

  static removeMember(group: Group, studentId: string): void {
    group.members = group.members.filter(id => id !== studentId);
  }
}
