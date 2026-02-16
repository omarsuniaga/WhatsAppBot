/**
 * AlertService - Servicio de generación de alertas basadas en KPIs
 */

import { eventBusService, FrameworkEventType } from './EventBusService';
import { indicatorRepository } from '../repositories/IndicatorRepository';
import { studentRepository } from '../repositories/StudentRepository';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  entityType: string;
  entityId: string;
  message: string;
  details: Record<string, any>;
  createdAt: Date;
  isResolved: boolean;
  resolvedAt?: Date;
  acknowledgedBy?: string;
}

export enum AlertType {
  STUDENT_AT_RISK = 'STUDENT_AT_RISK',
  INDICATOR_THRESHOLD = 'INDICATOR_THRESHOLD',
  INSTRUMENT_MAINTENANCE = 'INSTRUMENT_MAINTENANCE',
  ATTENDANCE_CRITICAL = 'ATTENDANCE_CRITICAL',
  ACADEMIC_FAILURE = 'ACADEMIC_FAILURE',
  GROUP_FULL = 'GROUP_FULL',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export class AlertService {
  private alerts: Map<string, Alert> = new Map();
  private alertListeners: Set<(alert: Alert) => void> = new Set();

  constructor() {
    // Escuchar eventos y generar alertas automáticamente
    eventBusService.on(FrameworkEventType.STUDENT_AT_RISK, (data) =>
      this.handleStudentAtRisk(data)
    );
    eventBusService.on(FrameworkEventType.EVALUATION_FAILED, (data) =>
      this.handleEvaluationFailed(data)
    );
    eventBusService.on(FrameworkEventType.INDICATOR_ALERT, (data) =>
      this.handleIndicatorAlert(data)
    );
  }

  /**
   * Crea una alerta nueva
   */
  async createAlert(
    type: AlertType,
    severity: AlertSeverity,
    entityType: string,
    entityId: string,
    message: string,
    details: Record<string, any> = {}
  ): Promise<Alert> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      entityType,
      entityId,
      message,
      details,
      createdAt: new Date(),
      isResolved: false,
    };

    this.alerts.set(alert.id, alert);

    // Emitir evento
    await eventBusService.emitAsync(
      FrameworkEventType.ALERT_GENERATED,
      alert,
      'AlertService'
    );

    // Notificar listeners
    this.alertListeners.forEach((listener) => listener(alert));

    return alert;
  }

  /**
   * Obtiene todas las alertas activas
   */
  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter((a) => !a.isResolved);
  }

  /**
   * Obtiene alertas por tipo
   */
  async getAlertsByType(type: AlertType): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter((a) => a.type === type && !a.isResolved);
  }

  /**
   * Obtiene alertas por severidad
   */
  async getAlertsBySeverity(severity: AlertSeverity): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter(
      (a) => a.severity === severity && !a.isResolved
    );
  }

  /**
   * Obtiene alertas de una entidad específica
   */
  async getAlertsByEntity(entityType: string, entityId: string): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter(
      (a) =>
        a.entityType === entityType &&
        a.entityId === entityId &&
        !a.isResolved
    );
  }

  /**
   * Marca una alerta como OK/resuelta
   */
  async resolveAlert(alertId: string, acknowledgedBy?: string): Promise<Alert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    alert.isResolved = true;
    alert.resolvedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    this.alerts.set(alertId, alert);
    return alert;
  }

  /**
   * Estima alertas críticas para un período
   */
  async getAlertSummary(): Promise<{
    total: number;
    byType: Record<AlertType, number>;
    bySeverity: Record<AlertSeverity, number>;
    critical: number;
    warning: number;
  }> {
    const active = await this.getActiveAlerts();

    const byType: Record<AlertType, number> = {
      [AlertType.STUDENT_AT_RISK]: 0,
      [AlertType.INDICATOR_THRESHOLD]: 0,
      [AlertType.INSTRUMENT_MAINTENANCE]: 0,
      [AlertType.ATTENDANCE_CRITICAL]: 0,
      [AlertType.ACADEMIC_FAILURE]: 0,
      [AlertType.GROUP_FULL]: 0,
      [AlertType.SYSTEM_ALERT]: 0,
    };

    const bySeverity: Record<AlertSeverity, number> = {
      [AlertSeverity.INFO]: 0,
      [AlertSeverity.WARNING]: 0,
      [AlertSeverity.ERROR]: 0,
      [AlertSeverity.CRITICAL]: 0,
    };

    for (const alert of active) {
      byType[alert.type]++;
      bySeverity[alert.severity]++;
    }

    return {
      total: active.length,
      byType,
      bySeverity,
      critical: bySeverity[AlertSeverity.CRITICAL],
      warning: bySeverity[AlertSeverity.WARNING],
    };
  }

  /**
   * Handler para evento de estudiante en riesgo
   */
  private async handleStudentAtRisk(data: any): Promise<void> {
    await this.createAlert(
      AlertType.STUDENT_AT_RISK,
      AlertSeverity.WARNING,
      'STUDENT',
      data.studentId,
      `Estudiante ${data.studentName} entra en categoría de riesgo`,
      {
        riskScore: data.riskScore,
        reason: data.reason,
      }
    );
  }

  /**
   * Handler para evento de evaluación fallida
   */
  private async handleEvaluationFailed(data: any): Promise<void> {
    await this.createAlert(
      AlertType.ACADEMIC_FAILURE,
      AlertSeverity.ERROR,
      'EVALUATION',
      data.evaluationId,
      `Evaluación no aprobada: ${data.studentName}`,
      {
        score: data.score,
        studentId: data.studentId,
        activityId: data.activityId,
      }
    );
  }

  /**
   * Handler para evento de alerta de indicador
   */
  private async handleIndicatorAlert(data: any): Promise<void> {
    const severity =
      data.value < 30 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;

    await this.createAlert(
      AlertType.INDICATOR_THRESHOLD,
      severity,
      'INDICATOR',
      data.indicatorId,
      `Indicador ${data.indicatorName} por debajo del umbral: ${data.value.toFixed(2)}%`,
      {
        value: data.value,
        threshold: data.threshold,
      }
    );
  }

  /**
   * Registra un listener para nuevas alertas
   */
  onNewAlert(listener: (alert: Alert) => void): () => void {
    this.alertListeners.add(listener);

    // Retornar función para desuscribirse
    return () => {
      this.alertListeners.delete(listener);
    };
  }

  /**
   * Obtiene el historial completo de alertas
   */
  getAllAlerts(includeResolved: boolean = false): Alert[] {
    const all = Array.from(this.alerts.values());
    if (includeResolved) return all;
    return all.filter((a) => !a.isResolved);
  }

  /**
   * Limpia alertas resueltas más antiguas de X días
   */
  async cleanOldResolvedAlerts(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deleted = 0;
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.isResolved && alert.resolvedAt && alert.resolvedAt < cutoffDate) {
        this.alerts.delete(id);
        deleted++;
      }
    }

    return deleted;
  }
}

export const alertService = new AlertService();
