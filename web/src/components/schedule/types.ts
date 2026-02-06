/**
 * Schedule Types and Constants
 */

export interface Schedule {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
}

export interface ClassGroup {
    id: string;
    name: string;
    program: string;
    level: string;
    teacherIds: string[];
    teacherNames?: string[];
    room?: string;
    schedules: Schedule[];
    enrolledCount?: number;
    capacity?: number;
}

export interface Room {
    id: string;
    name: string;
    capacity: number;
    color: string;
}

export interface Conflict {
    type: 'room' | 'teacher';
    classes: string[];
    day: number;
    time: string;
    resource: string;
}

export const API_BASE = 'http://localhost:3001/api/admin';

export const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WORKING_DAYS = [1, 2, 3, 4, 5, 6];

export const START_HOUR = 8;
export const END_HOUR = 21;
export const HOUR_HEIGHT = 60;

export const PROGRAM_COLORS: Record<string, { bg: string; border: string; text: string; solid: string }> = {
    orquesta: { 
        bg: 'bg-purple-100 dark:bg-purple-900/40', 
        border: 'border-purple-400 dark:border-purple-600',
        text: 'text-purple-800 dark:text-purple-200',
        solid: 'bg-purple-500'
    },
    coro: { 
        bg: 'bg-blue-100 dark:bg-blue-900/40', 
        border: 'border-blue-400 dark:border-blue-600',
        text: 'text-blue-800 dark:text-blue-200',
        solid: 'bg-blue-500'
    },
    iniciacion: { 
        bg: 'bg-emerald-100 dark:bg-emerald-900/40', 
        border: 'border-emerald-400 dark:border-emerald-600',
        text: 'text-emerald-800 dark:text-emerald-200',
        solid: 'bg-emerald-500'
    },
    preparatoria: { 
        bg: 'bg-amber-100 dark:bg-amber-900/40', 
        border: 'border-amber-400 dark:border-amber-600',
        text: 'text-amber-800 dark:text-amber-200',
        solid: 'bg-amber-500'
    },
};

export const ROOM_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

export type ViewMode = 'week' | 'rooms' | 'day' | 'list';

// Helper functions
export const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export const getBlockPosition = (startTime: string): number => {
    const minutes = timeToMinutes(startTime);
    const startMinutes = START_HOUR * 60;
    return ((minutes - startMinutes) / 60) * HOUR_HEIGHT;
};

export const getBlockHeight = (startTime: string, endTime: string): number => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    return ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
};
