/**
 * InstrumentRepository - Repositorio para gestionar Instrumentos
 */

import { BaseRepository } from './BaseRepository';
import { Instrument, InstrumentStatus, InstrumentMaintenance, MaintenanceType } from '../entities/Instrument';

export class InstrumentRepository extends BaseRepository<Instrument> {
  private maintenanceStorage: Map<string, InstrumentMaintenance[]> = new Map();

  /**
   * Encuentra instrumentos por estado
   */
  async findByStatus(status: InstrumentStatus): Promise<Instrument[]> {
    return this.findByCondition((instrument) => instrument.status === status);
  }

  /**
   * Encuentra instrumentos operativos
   */
  async findOperative(): Promise<Instrument[]> {
    return this.findByCondition((instrument) => instrument.status === InstrumentStatus.OPERATIVO);
  }

  /**
   * Encuentra instrumentos asignados a un estudiante
   */
  async findByStudent(studentId: string): Promise<Instrument[]> {
    return this.findByCondition(
      (instrument) => instrument.assignedTo === studentId
    );
  }

  /**
   * Encuentra instrumentos sin asignar
   */
  async findUnassigned(): Promise<Instrument[]> {
    return this.findByCondition((instrument) => !instrument.assignedTo);
  }

  /**
   * Encuentra instrumentos que necesitan mantenimiento
   */
  async findNeedingMaintenance(): Promise<Instrument[]> {
    return this.findByCondition(
      (instrument) =>
        instrument.status === InstrumentStatus.MANTENIMIENTO ||
        instrument.status === InstrumentStatus.REPARACION
    );
  }

  /**
   * Guarda un registro de mantenimiento
   */
  async saveMaintenance(maintenance: InstrumentMaintenance): Promise<InstrumentMaintenance> {
    const key = `maintenance_${maintenance.instrumentId}`;
    const records = this.maintenanceStorage.get(key) || [];
    records.push(maintenance);
    this.maintenanceStorage.set(key, records);
    return maintenance;
  }

  /**
   * Obtiene historial de mantenimiento de un instrumento
   */
  async getMaintenanceHistory(instrumentId: string): Promise<InstrumentMaintenance[]> {
    const key = `maintenance_${instrumentId}`;
    const records = this.maintenanceStorage.get(key) || [];
    return records.sort(
      (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
    );
  }

  /**
   * Obtiene el último mantenimiento de un instrumento
   */
  async getLastMaintenance(instrumentId: string): Promise<InstrumentMaintenance | null> {
    const history = await this.getMaintenanceHistory(instrumentId);
    return history.length > 0 ? history[0] : null;
  }

  /**
   * Calcula días desde el último mantenimiento
   */
  async getDaysSinceLastMaintenance(instrumentId: string): Promise<number | null> {
    const lastMaintenance = await this.getLastMaintenance(instrumentId);
    if (!lastMaintenance) return null;

    const now = new Date();
    const lastDate = new Date(lastMaintenance.performedAt);
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Busca instrumentos por criterios múltiples
   */
  async search(query: {
    status?: InstrumentStatus;
    assignedTo?: string;
    type?: string;
    needsMaintenance?: boolean;
  }): Promise<Instrument[]> {
    const instruments = await this.findAll();
    let results = instruments;

    if (query.status) {
      results = results.filter((i) => i.status === query.status);
    }

    if (query.assignedTo) {
      results = results.filter((i) => i.assignedTo === query.assignedTo);
    }

    if (query.type) {
      results = results.filter((i) => i.type === query.type);
    }

    if (query.needsMaintenance) {
      results = results.filter(
        (i) => i.status === InstrumentStatus.MANTENIMIENTO || i.status === InstrumentStatus.REPARACION
      );
    }

    return results;
  }

  /**
   * Obtiene estadísticas de instrumentos
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<InstrumentStatus, number>;
    operative: number;
    assigned: number;
    unassigned: number;
    needingMaintenance: number;
  }> {
    const all = await this.findAll();

    const byStatus: Record<InstrumentStatus, number> = {
      [InstrumentStatus.OPERATIVO]: 0,
      [InstrumentStatus.REPARACION]: 0,
      [InstrumentStatus.MANTENIMIENTO]: 0,
      [InstrumentStatus.DESCARTADO]: 0,
    };

    for (const instrument of all) {
      byStatus[instrument.status]++;
    }

    const operative = await this.findOperative();
    const assigned = all.filter((i) => i.assignedTo).length;
    const unassigned = all.filter((i) => !i.assignedTo).length;
    const needingMaintenance = await this.findNeedingMaintenance();

    return {
      total: all.length,
      byStatus,
      operative: operative.length,
      assigned,
      unassigned,
      needingMaintenance: needingMaintenance.length,
    };
  }

  /**
   * Obtiene instrumentos próximos a necesitar mantenimiento
   */
  async findDueForMaintenance(daysIntervalMonths: number = 6): Promise<Instrument[]> {
    const all = await this.findOperative();
    const dueInstruments: Instrument[] = [];

    for (const instrument of all) {
      const daysSince = await this.getDaysSinceLastMaintenance(instrument.id);
      const daysThreshold = daysIntervalMonths * 30; // aproximado

      if (daysSince === null || daysSince > daysThreshold) {
        dueInstruments.push(instrument);
      }
    }

    return dueInstruments;
  }
}

export const instrumentRepository = new InstrumentRepository();
