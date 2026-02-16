/**
 * EvaluationRepository - Repositorio para gestionar Evaluaciones
 */

import { BaseRepository } from './BaseRepository';
import { Evaluation } from '../entities/Evaluation';

export class EvaluationRepository extends BaseRepository<Evaluation> {
  /**
   * Encuentra evaluaciones de un estudiante
   */
  async findByStudent(studentId: string): Promise<Evaluation[]> {
    return this.findByCondition((evaluation) => evaluation.studentId === studentId);
  }

  /**
   * Encuentra evaluaciones por maestro
   */
  async findByTeacher(teacherId: string): Promise<Evaluation[]> {
    return this.findByCondition((evaluation) => evaluation.teacherId === teacherId);
  }

  /**
   * Encuentra evaluaciones de una actividad
   */
  async findByActivity(activityId: string): Promise<Evaluation[]> {
    return this.findByCondition((evaluation) => evaluation.activityId === activityId);
  }

  /**
   * Encuentra evaluaciones aprobadas
   */
  async findPassing(): Promise<Evaluation[]> {
    return this.findByCondition((evaluation) => evaluation.score >= 70);
  }

  /**
   * Encuentra evaluaciones no aprobadas
   */
  async findFailing(): Promise<Evaluation[]> {
    return this.findByCondition((evaluation) => evaluation.score < 70);
  }

  /**
   * Calcula el promedio de un estudiante
   */
  async calculateStudentAverage(studentId: string): Promise<number> {
    const evaluations = await this.findByStudent(studentId);
    if (evaluations.length === 0) return 0;

    const total = evaluations.reduce((sum, e) => sum + e.score, 0);
    return total / evaluations.length;
  }

  /**
   * Calcula estadísticas de evaluaciones por actividad
   */
  async getActivityEvaluationStats(activityId: string): Promise<{
    total: number;
    average: number;
    highest: number;
    lowest: number;
    passingCount: number;
    failingCount: number;
    passingRate: number;
  }> {
    const evaluations = await this.findByActivity(activityId);

    if (evaluations.length === 0) {
      return {
        total: 0,
        average: 0,
        highest: 0,
        lowest: 0,
        passingCount: 0,
        failingCount: 0,
        passingRate: 0,
      };
    }

    const scores = evaluations.map((e) => e.score);
    const passingCount = evaluations.filter((e) => e.score >= 70).length;
    const failingCount = evaluations.filter((e) => e.score < 70).length;

    return {
      total: evaluations.length,
      average: scores.reduce((a, b) => a + b, 0) / scores.length,
      highest: Math.max(...scores),
      lowest: Math.min(...scores),
      passingCount,
      failingCount,
      passingRate: passingCount / evaluations.length,
    };
  }

  /**
   * Busca evaluaciones por criterios múltiples
   */
  async search(query: {
    studentId?: string;
    teacherId?: string;
    activityId?: string;
    minScore?: number;
    maxScore?: number;
    dateStart?: Date;
    dateEnd?: Date;
  }): Promise<Evaluation[]> {
    return this.findByCondition((evaluation) => {
      if (query.studentId && evaluation.studentId !== query.studentId) return false;
      if (query.teacherId && evaluation.teacherId !== query.teacherId) return false;
      if (query.activityId && evaluation.activityId !== query.activityId) return false;
      if (query.minScore !== undefined && evaluation.score < query.minScore) return false;
      if (query.maxScore !== undefined && evaluation.score > query.maxScore) return false;
      if (query.dateStart && evaluation.evaluatedAt < query.dateStart) return false;
      if (query.dateEnd && evaluation.evaluatedAt > query.dateEnd) return false;
      return true;
    });
  }

  /**
   * Obtiene resumen general de evaluaciones
   */
  async getSummary(): Promise<{
    total: number;
    average: number;
    passingCount: number;
    failingCount: number;
    passingRate: number;
  }> {
    const all = await this.findAll();

    if (all.length === 0) {
      return {
        total: 0,
        average: 0,
        passingCount: 0,
        failingCount: 0,
        passingRate: 0,
      };
    }

    const scores = all.map((e) => e.score);
    const passingCount = all.filter((e) => e.score >= 70).length;
    const failingCount = all.filter((e) => e.score < 70).length;

    return {
      total: all.length,
      average: scores.reduce((a, b) => a + b, 0) / scores.length,
      passingCount,
      failingCount,
      passingRate: passingCount / all.length,
    };
  }

  /**
   * Obtiene el historial de evaluaciones de un estudiante ordenado
   */
  async getStudentEvaluationHistory(studentId: string): Promise<Evaluation[]> {
    const evaluations = await this.findByStudent(studentId);
    return evaluations.sort(
      (a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime()
    );
  }
}

export const evaluationRepository = new EvaluationRepository();
