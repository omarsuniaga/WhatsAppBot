/**
 * IndicatorRepository - Repositorio para gestionar Indicadores
 */

import { BaseRepository } from './BaseRepository';
import { Indicator, IndicatorResult, CalculationFrequency } from '../entities/Indicator';

export class IndicatorRepository extends BaseRepository<Indicator> {
  private resultsStorage: Map<string, IndicatorResult[]> = new Map();

  /**
   * Encuentra indicadores activos
   */
  async findActive(): Promise<Indicator[]> {
    return this.findByCondition((indicator) => indicator.isActive === true);
  }

  /**
   * Encuentra indicadores por categoría
   */
  async findByCategory(category: string): Promise<Indicator[]> {
    return this.findByCondition((indicator) => indicator.category === category);
  }

  /**
   * Encuentra indicadores por frecuencia de cálculo
   */
  async findByFrequency(frequency: CalculationFrequency): Promise<Indicator[]> {
    return this.findByCondition((indicator) => indicator.calculationFrequency === frequency);
  }

  /**
   * Guarda un resultado de indicador
   */
  async saveResult(result: IndicatorResult): Promise<IndicatorResult> {
    const key = `results_${result.indicatorId}`;
    const results = this.resultsStorage.get(key) || [];
    results.push(result);
    this.resultsStorage.set(key, results);
    return result;
  }

  /**
   * Obtiene resultados de un indicador
   */
  async getResults(indicatorId: string): Promise<IndicatorResult[]> {
    const key = `results_${indicatorId}`;
    return this.resultsStorage.get(key) || [];
  }

  /**
   * Obtiene el resultado más reciente de un indicador
   */
  async getLatestResult(indicatorId: string): Promise<IndicatorResult | null> {
    const results = await this.getResults(indicatorId);
    if (results.length === 0) return null;

    return results.reduce((latest, current) =>
      new Date(current.calculatedAt) > new Date(latest.calculatedAt) ? current : latest
    );
  }

  /**
   * Obtiene resultados de un indicador en un período
   */
  async getResultsByPeriod(
    indicatorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IndicatorResult[]> {
    const results = await this.getResults(indicatorId);
    return results.filter(
      (r) =>
        new Date(r.calculatedAt) >= startDate &&
        new Date(r.calculatedAt) <= endDate
    );
  }

  /**
   * Busca indicadores por criterios múltiples
   */
  async search(query: {
    category?: string;
    frequency?: CalculationFrequency;
    isActive?: boolean;
  }): Promise<Indicator[]> {
    return this.findByCondition((indicator) => {
      if (query.category && indicator.category !== query.category) return false;
      if (query.frequency && indicator.calculationFrequency !== query.frequency) return false;
      if (query.isActive !== undefined && indicator.isActive !== query.isActive) return false;
      return true;
    });
  }

  /**
   * Obtiene estadísticas de indicadores
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    byCategory: Record<string, number>;
    byFrequency: Record<CalculationFrequency, number>;
  }> {
    const all = await this.findAll();

    const byCategory: Record<string, number> = {};
    const byFrequency: Record<CalculationFrequency, number> = {
      [CalculationFrequency.DAILY]: 0,
      [CalculationFrequency.WEEKLY]: 0,
      [CalculationFrequency.MONTHLY]: 0,
      [CalculationFrequency.QUARTERLY]: 0,
      [CalculationFrequency.YEARLY]: 0,
    };

    for (const indicator of all) {
      // Count by category
      const cat = indicator.category || 'general';
      byCategory[cat as any] = (byCategory[cat as any] || 0) + 1;
      // Count by frequency
      byFrequency[indicator.calculationFrequency]++;
    }

    return {
      total: all.length,
      active: all.filter((i) => i.isActive).length,
      byCategory,
      byFrequency,
    };
  }

  /**
   * Obtiene un resumen del estado actual de todos los indicadores
   */
  async getHealthCheck(): Promise<{
    total: number;
    exitosos: number;
    alertas: number;
    exitRate: number;
  }> {
    const all = await this.findActive();
    let exitosos = 0;
    let alertas = 0;

    for (const indicator of all) {
      const latestResult = await this.getLatestResult(indicator.id);
      if (!latestResult) continue;

      if (latestResult.isSuccessful) {
        exitosos++;
      } else {
        alertas++;
      }
    }

    return {
      total: all.length,
      exitosos,
      alertas,
      exitRate: all.length > 0 ? exitosos / all.length : 0,
    };
  }

  /**
   * Limpia resultados antiguos (más de X días)
   */
  async cleanOldResults(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deletedCount = 0;
    for (const [key, results] of this.resultsStorage.entries()) {
      const filtered = results.filter((r) => new Date(r.calculatedAt) >= cutoffDate);
      const deleted = results.length - filtered.length;
      if (deleted > 0) {
        this.resultsStorage.set(key, filtered);
        deletedCount += deleted;
      }
    }

    return deletedCount;
  }
}

export const indicatorRepository = new IndicatorRepository();
