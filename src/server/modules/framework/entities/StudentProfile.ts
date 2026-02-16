/**
 * Entity: StudentProfile
 * Perfil académico del estudiante
 */

export enum StudentLevel {
  BEGINNER = 'beginner',
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

export enum StudentStatus {
  ACTIVE = 'active',
  GRADUATED = 'graduated',
  DROPPED = 'dropped',
  ON_LEAVE = 'on_leave'
}

export interface StudentProfile {
  id: string;
  personId: string;
  level: StudentLevel;
  enrollmentYear: number;
  mainInstrument?: string;
  secondaryInstruments: string[];
  groupIds: string[];
  parentIds: string[];
  
  // Calculated metrics
  totalAttendedHours: number;
  attendanceRate: number; // 0-100
  passedEvaluations: number;
  totalEvaluations: number;
  approvalRate: number; // calculated
  skills: string[];
  
  status: StudentStatus;
  riskScore: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export class StudentProfileFactory {
  static create(personId: string, createdBy: string): StudentProfile {
    return {
      id: `STU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      personId,
      level: StudentLevel.BEGINNER,
      enrollmentYear: new Date().getFullYear(),
      mainInstrument: undefined,
      secondaryInstruments: [],
      groupIds: [],
      parentIds: [],
      totalAttendedHours: 0,
      attendanceRate: 0,
      passedEvaluations: 0,
      totalEvaluations: 0,
      approvalRate: 0,
      skills: [],
      status: StudentStatus.ACTIVE,
      riskScore: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy
    };
  }

  static calculateApprovalRate(profile: StudentProfile): number {
    if (profile.totalEvaluations === 0) return 0;
    profile.approvalRate = (profile.passedEvaluations / profile.totalEvaluations) * 100;
    return profile.approvalRate;
  }

  static calculateRiskScore(profile: StudentProfile): number {
    let score = 0;
    if (profile.attendanceRate < 70) score += 40;
    if (StudentProfileFactory.calculateApprovalRate(profile) < 60) score += 40;
    if (profile.status !== StudentStatus.ACTIVE) score += 20;
    profile.riskScore = Math.min(score, 100);
    return score;
  }

  static isAtRisk(profile: StudentProfile): boolean {
    return StudentProfileFactory.calculateRiskScore(profile) >= 50;
  }

  static hasSkill(profile: StudentProfile, skill: string): boolean {
    return profile.skills.includes(skill);
  }

  static addSkill(profile: StudentProfile, skill: string): void {
    if (!StudentProfileFactory.hasSkill(profile, skill)) {
      profile.skills.push(skill);
    }
  }
}
