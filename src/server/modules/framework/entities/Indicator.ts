/**
 * Entity: Indicator
 * Indicadores clave de rendimiento (KPIs)
 */

import * as crypto from 'crypto';

export enum IndicatorMethod {
  COUNT = 'count',
  SUM = 'sum',
  AVERAGE = 'average',
  PERCENTAGE = 'percentage',
  CUSTOM = 'custom'
}

export enum CalculationFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

export interface Indicator {
  id: string;
  codigo: string; // Único
  titulo: string;
  descripcion: string;
  formula: string;
  metodo: IndicatorMethod;
  valorObjetivo: number;
  unidad: string;
  umbralMinimo: number;
  umbralMaximo: number;
  calcularCada: CalculationFrequency;
  comoDebeCalcularse?: string;
  objetivoPartePrincipal?: string;
  resultadoEsperado?: string;
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
}

export interface IndicatorResult {
  id: string;
  indicatorId: string;
  periodStart: Date;
  periodEnd: Date;
  value: number;
  method: IndicatorMethod;
  calculatedAt: Date;
  calculatedBy: string;
  isSuccessful: boolean;
  alert: string | null;
  notes: string;
  hash: string;
  version: number;
  readonly: boolean;
  dataSourceCount: number;
}

export interface Indicator extends Partial<IndicatorResult> {
  code: string;
  title: string;
  description: string;
  formula: string;
  calculationFrequency: CalculationFrequency;
  targetValue: number;
  unit: string;
  minThreshold: number;
  maxThreshold: number;
  category?: string;
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
}

export class IndicatorFactory {
  static crear(datos: Partial<Indicator>, createdBy: string): Indicator {
    return {
      id: `IND-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      code: datos.code || '',
      title: datos.title || '',
      description: datos.description || '',
      formula: datos.formula || '',
      method: datos.method || IndicatorMethod.COUNT,
      targetValue: datos.targetValue || 100,
      unit: datos.unit || 'units',
      minThreshold: datos.minThreshold ?? 0,
      maxThreshold: datos.maxThreshold ?? 1000000,
      calculationFrequency: datos.calculationFrequency || CalculationFrequency.MONTHLY,
      category: datos.category || 'general',
      isActive: datos.isActive !== false,
      createdAt: new Date(),
      createdBy,
      version: 1,
      readonly: false
    } as Indicator;
  }

  static isInRange(indicator: Indicator, value: number): boolean {
    return value >= indicator.minThreshold && value <= indicator.maxThreshold;
  }

  static calculateCompliance(indicator: Indicator, value: number): number {
    if (indicator.targetValue === 0) return 0;
    return Math.round((value / indicator.targetValue) * 100);
  }
}

export class IndicatorResultFactory {
  static crear(
    indicatorId: string,
    value: number,
    periodStart: Date,
    periodEnd: Date,
    dataSourceCount: number = 0,
    calculatedBy: string = 'system'
  ): IndicatorResult {
    const result: IndicatorResult = {
      id: `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      indicatorId,
      periodStart,
      periodEnd,
      value,
      method: IndicatorMethod.AVERAGE,
      calculatedAt: new Date(),
      calculatedBy,
      isSuccessful: false,
      alert: null,
      notes: '',
      hash: '',
      version: 1,
      readonly: true,
      dataSourceCount
    };

    result.hash = IndicatorResultFactory.generateHash(result);
    return result;
  }

  static generateHash(result: IndicatorResult): string {
    const data = JSON.stringify({
      indicatorId: result.indicatorId,
      value: result.value,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static verifyIntegrity(result: IndicatorResult, expectedHash: string): boolean {
    return result.hash === expectedHash;
  }

  static isSuccessful(result: IndicatorResult): boolean {
    return result.isSuccessful;
  }

  static isAlert(result: IndicatorResult): boolean {
    return result.alert !== null && result.alert !== '';
  }
}
