/**
 * Core Data Models for Class Management System
 * Students, Teachers, Rooms, Classes with relationships
 */

// ============ STUDENT MODEL ============
export interface Parent {
    name: string;
    relationship: 'madre' | 'padre' | 'tutor' | 'otro';
    phone: string;
    email?: string;
    isEmergencyContact?: boolean;
}

export interface Student {
    id: string;
    firstName: string;
    lastName: string;
    birthDate?: string;
    age?: number;
    phone?: string;
    email?: string;
    address?: string;
    parents: Parent[];
    enrollmentDate: string;
    status: 'active' | 'inactive' | 'suspended';
    notes?: string;
    photoUrl?: string;
    classIds?: string[]; // Classes the student is enrolled in
}

// ============ TEACHER MODEL ============
export interface Teacher {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    specialty: string[]; // e.g., ['violin', 'viola', 'teoria']
    status: 'active' | 'inactive';
    hireDate?: string;
    notes?: string;
    photoUrl?: string;
}

// ============ ROOM MODEL ============
export interface Room {
    id: string;
    name: string;
    capacity: number;
    description?: string;
    equipment?: string[]; // e.g., ['piano', 'pizarra', 'proyector']
    color: string; // For visual distinction in schedule
    status: 'available' | 'maintenance' | 'unavailable';
}

// ============ SCHEDULE MODEL ============
export interface Schedule {
    id?: string;
    dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
    startTime: string; // "HH:MM" format
    endTime: string;
}

// ============ CLASS GROUP MODEL ============
export interface ClassGroup {
    id: string;
    name: string;
    program: 'orquesta' | 'coro' | 'iniciacion' | 'preparatoria';
    level: string;
    description?: string;
    
    // Relationships
    teacherIds: string[];
    teacherNames?: string[]; // Denormalized for display
    roomId?: string;
    room?: string; // Room name for display
    studentIds: string[];
    
    // Schedule
    schedules: Schedule[];
    
    // Capacity
    capacity?: number;
    enrolledCount?: number;
    
    // Status
    status: 'active' | 'inactive' | 'completed';
    startDate?: string;
    endDate?: string;
    
    createdAt?: string;
    updatedAt?: string;
}

// ============ CONFLICT DETECTION ============
export interface ScheduleConflict {
    type: 'room' | 'teacher' | 'student';
    severity: 'error' | 'warning';
    message: string;
    classes: string[];
    day: number;
    time: string;
    resource: string;
}

// ============ HELPER FUNCTIONS ============
export const getFullName = (person: { firstName: string; lastName: string }) => 
    `${person.firstName} ${person.lastName}`;

export const getAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
};

export const formatPhone = (phone: string): string => {
    // Format: +XX XXX XXX XXXX or similar
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
};

// Program display names
export const PROGRAM_NAMES: Record<string, string> = {
    orquesta: 'Orquesta',
    coro: 'Coro',
    iniciacion: 'Iniciación Musical',
    preparatoria: 'Preparatoria',
};

// Status display names
export const STATUS_NAMES: Record<string, string> = {
    active: 'Activo',
    inactive: 'Inactivo',
    suspended: 'Suspendido',
    completed: 'Completado',
    available: 'Disponible',
    maintenance: 'En Mantenimiento',
    unavailable: 'No Disponible',
};

// Days of week
export const DAYS_OF_WEEK = [
    { value: 0, label: 'Domingo', short: 'Dom' },
    { value: 1, label: 'Lunes', short: 'Lun' },
    { value: 2, label: 'Martes', short: 'Mar' },
    { value: 3, label: 'Miércoles', short: 'Mié' },
    { value: 4, label: 'Jueves', short: 'Jue' },
    { value: 5, label: 'Viernes', short: 'Vie' },
    { value: 6, label: 'Sábado', short: 'Sáb' },
];
