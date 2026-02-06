/**
 * Domain ID Helpers - ID generation and prefixes
 * El Sistema Punta Cana - Institutional WhatsApp Bot
 * 
 * Convention: All IDs are prefixed to identify entity type at a glance
 */

// ==========================================
// ID PREFIXES
// ==========================================

export const ID_PREFIX = {
    Contact: 'ct_',
    Student: 'st_',
    Teacher: 'tc_',
    Program: 'pg_',
    Level: 'lv_',
    ClassGroup: 'cl_',
    Enrollment: 'en_',
    Session: 'ss_',
    AttendanceRecord: 'ar_',
    WhatsAppGroup: 'wa_',
    Template: 'tpl_',
    KnowledgeFile: 'kb_',
    EventLog: 'ev_',
    StudentProgress: 'pr_',
    Trigger: 'tgr_'
} as const;

export type IdPrefix = typeof ID_PREFIX[keyof typeof ID_PREFIX];

// ==========================================
// ID GENERATION
// ==========================================

/**
 * Generate a random alphanumeric string
 */
const randomString = (length: number = 12): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

/**
 * Generate a prefixed ID
 */
export const generateId = (prefix: IdPrefix): string => {
    return `${prefix}${randomString(12)}`;
};

/**
 * Entity-specific ID generators
 */
export const createId = {
    contact: () => generateId(ID_PREFIX.Contact),
    student: () => generateId(ID_PREFIX.Student),
    teacher: () => generateId(ID_PREFIX.Teacher),
    program: () => generateId(ID_PREFIX.Program),
    level: () => generateId(ID_PREFIX.Level),
    classGroup: () => generateId(ID_PREFIX.ClassGroup),
    enrollment: () => generateId(ID_PREFIX.Enrollment),
    session: () => generateId(ID_PREFIX.Session),
    attendanceRecord: () => generateId(ID_PREFIX.AttendanceRecord),
    whatsAppGroup: () => generateId(ID_PREFIX.WhatsAppGroup),
    template: () => generateId(ID_PREFIX.Template),
    knowledgeFile: () => generateId(ID_PREFIX.KnowledgeFile),
    eventLog: () => generateId(ID_PREFIX.EventLog),
    studentProgress: () => generateId(ID_PREFIX.StudentProgress),
    trigger: () => generateId(ID_PREFIX.Trigger)
};

// ==========================================
// ID VALIDATION
// ==========================================

/**
 * Check if an ID has the expected prefix
 */
export const hasPrefix = (id: string, prefix: IdPrefix): boolean => {
    return id.startsWith(prefix);
};

/**
 * Extract prefix from an ID
 */
export const extractPrefix = (id: string): IdPrefix | null => {
    for (const prefix of Object.values(ID_PREFIX)) {
        if (id.startsWith(prefix)) {
            return prefix;
        }
    }
    return null;
};

/**
 * Get entity type from ID
 */
export const getEntityType = (id: string): string | null => {
    const prefixToType: Record<IdPrefix, string> = {
        [ID_PREFIX.Contact]: 'Contact',
        [ID_PREFIX.Student]: 'Student',
        [ID_PREFIX.Teacher]: 'Teacher',
        [ID_PREFIX.Program]: 'Program',
        [ID_PREFIX.Level]: 'Level',
        [ID_PREFIX.ClassGroup]: 'ClassGroup',
        [ID_PREFIX.Enrollment]: 'Enrollment',
        [ID_PREFIX.Session]: 'Session',
        [ID_PREFIX.AttendanceRecord]: 'AttendanceRecord',
        [ID_PREFIX.WhatsAppGroup]: 'WhatsAppGroup',
        [ID_PREFIX.Template]: 'Template',
        [ID_PREFIX.KnowledgeFile]: 'KnowledgeFile',
        [ID_PREFIX.EventLog]: 'EventLog',
        [ID_PREFIX.StudentProgress]: 'StudentProgress',
        [ID_PREFIX.Trigger]: 'Trigger'
    };

    const prefix = extractPrefix(id);
    return prefix ? prefixToType[prefix] : null;
};

/**
 * Validate ID format
 */
export const isValidId = (id: string): boolean => {
    if (!id || typeof id !== 'string') return false;
    const prefix = extractPrefix(id);
    if (!prefix) return false;
    // ID should be prefix + 12 alphanumeric chars
    const suffix = id.slice(prefix.length);
    return /^[a-z0-9]{12}$/.test(suffix);
};
