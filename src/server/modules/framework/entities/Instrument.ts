/**
 * Entity: Instrument
 * Instrumentos musicales y su mantenimiento
 */

export enum InstrumentStatus {
  OPERATIVO = 'operativo',
  REPARACION = 'reparacion',
  MANTENIMIENTO = 'mantenimiento',
  DESCARTADO = 'descartado'
}

export enum MaintenanceType {
  INSPECTION = 'inspection',
  REPAIR = 'repair',
  PREVENTIVE = 'preventive',
  CLEANING = 'cleaning'
}

export interface Instrument {
  id: string;
  code: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  acquisitionYear?: number;
  acquisitionCost?: number;
  isExpensive: boolean;
  status: InstrumentStatus;
  assignedTo?: string;
  type?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface InstrumentMaintenance {
  id: string;
  instrumentId: string;
  type: MaintenanceType;
  description: string;
  performedAt: Date;
  performedBy: string;
  durationHours: number;
  cost?: number;
  notes?: string;
  createdAt: Date;
  createdBy: string;
}

export class InstrumentFactory {
  static create(data: Partial<Instrument>, createdBy: string): Instrument {
    return {
      id: `INS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      code: data.code || '',
      name: data.name || '',
      brand: data.brand,
      model: data.model,
      serialNumber: data.serialNumber,
      acquisitionYear: data.acquisitionYear,
      acquisitionCost: data.acquisitionCost,
      isExpensive: data.isExpensive || false,
      status: data.status || InstrumentStatus.OPERATIVO,
      assignedTo: data.assignedTo,
      type: data.type,
      notes: data.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy
    };
  }

  static canBeAssigned(instrument: Instrument): boolean {
    return instrument.status === InstrumentStatus.OPERATIVO && !instrument.assignedTo;
  }

  static assignToStudent(instrument: Instrument, studentId: string): boolean {
    if (InstrumentFactory.canBeAssigned(instrument)) {
      instrument.assignedTo = studentId;
      return true;
    }
    return false;
  }

  static unassign(instrument: Instrument): void {
    instrument.assignedTo = undefined;
  }
}

export class MaintenanceFactory {
  static create(
    instrumentId: string,
    type: MaintenanceType,
    performedBy: string,
    createdBy: string
  ): InstrumentMaintenance {
    return {
      id: `MNT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      instrumentId,
      type,
      description: '',
      performedAt: new Date(),
      performedBy,
      durationHours: 1,
      cost: undefined,
      notes: undefined,
      createdAt: new Date(),
      createdBy
    };
  }

  static isRecent(maintenance: InstrumentMaintenance, dayThreshold: number = 30): boolean {
    const now = new Date();
    const daysPassed =
      (now.getTime() - maintenance.performedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysPassed < dayThreshold;
  }
}
