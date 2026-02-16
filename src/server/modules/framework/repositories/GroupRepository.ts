/**
 * GroupRepository - Repositorio para gestionar Grupos y Acciones de Comunicación
 */

import { BaseRepository } from './BaseRepository';
import { Group, CommunicationAction } from '../entities/Group';

export class GroupRepository extends BaseRepository<Group> {
  private communicationActionStorage: Map<string, CommunicationAction[]> = new Map();

  /**
   * Encuentra grupos por tipo
   */
  async findByType(type: string): Promise<Group[]> {
    return this.findByCondition((group) => group.type === type);
  }

  /**
   * Encuentra grupos por director
   */
  async findByDirector(directorId: string): Promise<Group[]> {
    return this.findByCondition((group) => group.directorId === directorId);
  }

  /**
   * Encuentra grupos que contienen a un miembro
   */
  async findByMember(memberId: string): Promise<Group[]> {
    return this.findByCondition((group) =>
      group.members.some((m) => m === memberId)
    );
  }

  /**
   * Encuentra grupos activos (con capacidad disponible)
   */
  async findActive(): Promise<Group[]> {
    return this.findByCondition(
      (group) => group.members.length < group.capacity
    );
  }

  /**
   * Guarda una acción de comunicación
   */
  async saveCommunicationAction(action: CommunicationAction): Promise<CommunicationAction> {
    const key = `communication_${action.groupId}`;
    const actions = this.communicationActionStorage.get(key) || [];
    actions.push(action);
    this.communicationActionStorage.set(key, actions);
    return action;
  }

  /**
   * Obtiene acciones de comunicación de un grupo
   */
  async getCommunicationActions(groupId: string): Promise<CommunicationAction[]> {
    const key = `communication_${groupId}`;
    const actions = this.communicationActionStorage.get(key) || [];
    return actions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  /**
   * Obtiene acciones de comunicación recientes
   */
  async getRecentCommunicationActions(
    groupId: string,
    daysBack: number = 30
  ): Promise<CommunicationAction[]> {
    const actions = await this.getCommunicationActions(groupId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    return actions.filter((action) => new Date(action.date) >= cutoffDate);
  }

  /**
   * Busca grupos por criterios múltiples
   */
  async search(query: {
    type?: string;
    directorId?: string;
    withCapacity?: boolean;
  }): Promise<Group[]> {
    let results = await this.findAll();

    if (query.type) {
      results = results.filter((g) => g.type === query.type);
    }

    if (query.directorId) {
      results = results.filter((g) => g.directorId === query.directorId);
    }

    if (query.withCapacity) {
      results = results.filter((g) => g.members.length < g.capacity);
    }

    return results;
  }

  /**
   * Obtiene estadísticas de grupos
   */
  async getStatistics(): Promise<{
    total: number;
    withCapacity: number;
    totalMembers: number;
    averageCapacityUsed: number;
  }> {
    const all = await this.findAll();

    if (all.length === 0) {
      return {
        total: 0,
        withCapacity: 0,
        totalMembers: 0,
        averageCapacityUsed: 0,
      };
    }

    let totalMembers = 0;
    let totalCapacity = 0;
    const withCapacity = all.filter((g) => g.members.length < g.capacity).length;

    for (const group of all) {
      totalMembers += group.members.length;
      totalCapacity += group.capacity;
    }

    return {
      total: all.length,
      withCapacity,
      totalMembers,
      averageCapacityUsed: totalCapacity > 0 ? totalMembers / totalCapacity : 0,
    };
  }

  /**
   * Obtiene estadísticas de comunicación
   */
  async getCommunicationStatistics(groupId: string): Promise<{
    totalActions: number;
    byChannel: Record<string, number>;
    totalReach: number;
    averageReach: number;
  }> {
    const actions = await this.getCommunicationActions(groupId);
    const group = await this.findById(groupId);

    if (actions.length === 0) {
      return {
        totalActions: 0,
        byChannel: {},
        totalReach: 0,
        averageReach: 0,
      };
    }

    const byChannel: Record<string, number> = {};
    let totalReach = 0;

    for (const action of actions) {
      byChannel[action.channel] = (byChannel[action.channel] || 0) + 1;
      totalReach += action.actualReach || 0;
    }

    return {
      totalActions: actions.length,
      byChannel,
      totalReach,
      averageReach: totalReach / actions.length,
    };
  }

  /**
   * Obtiene grupos llenos (en capacidad máxima)
   */
  async findFullGroups(): Promise<Group[]> {
    return this.findByCondition(
      (group) => group.members.length >= group.capacity
    );
  }

  /**
   * Obtiene el porcentaje de ocupación de un grupo
   */
  async getOccupancyPercentage(groupId: string): Promise<number | null> {
    const group = await this.findById(groupId);
    if (!group) return null;
    return group.capacity > 0 ? (group.members.length / group.capacity) * 100 : 0;
  }
}

export const groupRepository = new GroupRepository();
