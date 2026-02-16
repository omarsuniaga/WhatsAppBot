/**
 * Entity: Evaluation
 * Evaluaciones académicas
 */

export interface RubricDetail {
  criterion: string;
  score: number;
  observations?: string;
  weight?: number;
}

export interface Evaluation {
  id: string;
  studentId: string;
  activityId: string;
  teacherId: string;
  level: string;
  instrument: string;
  score: number; // 0-100
  passed: boolean;
  rubricVersion: string;
  rubricDetails?: RubricDetail[];
  requirements: {
    minAttendance: boolean;
    minParticipation: boolean;
  };
  observations?: string;
  evaluatedAt: Date;
  evaluatedBy: string;
  createdAt: Date;
  createdBy: string;
}

export class EvaluationFactory {
  static create(
    studentId: string,
    activityId: string,
    teacherId: string,
    evaluatedBy: string
  ): Evaluation {
    return {
      id: `EVL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      studentId,
      activityId,
      teacherId,
      level: '',
      instrument: '',
      score: 0,
      passed: false,
      rubricVersion: 'v1.0',
      rubricDetails: [],
      requirements: {
        minAttendance: true,
        minParticipation: true
      },
      evaluatedAt: new Date(),
      evaluatedBy,
      createdAt: new Date(),
      createdBy: evaluatedBy
    };
  }

  static meetsRequirements(evaluation: Evaluation): boolean {
    return (
      evaluation.requirements.minAttendance &&
      evaluation.requirements.minParticipation
    );
  }

  static isValid(evaluation: Evaluation): boolean {
    return evaluation.passed && EvaluationFactory.meetsRequirements(evaluation);
  }

  static getGradeLabel(evaluation: Evaluation): string {
    if (evaluation.score >= 90) return 'Excellent';
    if (evaluation.score >= 80) return 'Very Good';
    if (evaluation.score >= 70) return 'Good';
    if (evaluation.score >= 60) return 'Passed';
    return 'Failed';
  }
}
