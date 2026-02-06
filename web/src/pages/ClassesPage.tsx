/**
 * ClassesPage - Professional Class Management
 * Connected directly to Firestore CLASES collection
 * Features: Multi-schedule, Conflict Detection, Collaboration
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    BookOpen, Plus, Search, Edit2, Trash2, RefreshCw, X, Save,
    Users, Clock, MapPin, User, AlertCircle, AlertTriangle,
    ChevronUp, ChevronDown, Share2, Calendar, Music, CheckCircle,
    UserPlus, Home, Sparkles, FileText, ClipboardCheck
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BulkImportModal } from '../components/classes/BulkImportModal';
import {
    clasesService, Clase, ScheduleSlot, ConflictResult,
    maestrosService, Maestro,
    salonesService, Salon,
    alumnosService, Alumno
} from '../services/firestore';
import { mergeClasses } from '../scripts/mergeClasses';

// Constants
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const STATUS_OPTIONS = [
    { value: 'active', label: 'Activa', color: 'green' },
    { value: 'inactive', label: 'Inactiva', color: 'gray' },
    { value: 'archived', label: 'Archivada', color: 'red' }
];

const INSTRUMENT_SECTIONS: Record<string, string[]> = {
    'Cuerdas': ['Violín', 'Viola', 'Violoncello', 'Contrabajo', 'Arpa', 'Guitarra', 'Cuatro'],
    'Maderas': ['Flauta', 'Oboe', 'Clarinete', 'Fagot', 'Piccolo', 'Corno Inglés', 'Flautín'],
    'Metales': ['Trompeta', 'Trompa', 'Corno', 'Trombón', 'Tuba'],
    'Percusión': ['Timbales', 'Redoblante', 'Platos', 'Xilófono', 'Marimba', 'Batería', 'Percusión'],
    'Piano/Teclados': ['Piano', 'Teclado', 'Órgano'],
    'Canto/Coral': ['Canto', 'Voz', 'Coral']
};

// Sort column type
type SortColumn = 'name' | 'teacher' | 'students' | 'schedule' | 'room' | 'status' | null;
type SortDirection = 'asc' | 'desc';

// Quick add modal types
type QuickAddType = 'teacher' | 'student' | 'room' | null;

export const ClassesPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Data state
    const [classes, setClasses] = useState<Clase[]>([]);
    const [teachers, setTeachers] = useState<Maestro[]>([]);
    const [rooms, setRooms] = useState<Salon[]>([]);
    const [students, setStudents] = useState<Alumno[]>([]);

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterTeacher, setFilterTeacher] = useState<string>('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingClass, setEditingClass] = useState<Partial<Clase> | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'schedule' | 'students' | 'sharing'>('info');

    // Conflict state
    const [conflicts, setConflicts] = useState<ConflictResult[]>([]);

    // Quick add state
    const [quickAddType, setQuickAddType] = useState<QuickAddType>(null);
    const [quickAddData, setQuickAddData] = useState<any>({});

    // Sorting state
    const [sortColumn, setSortColumn] = useState<SortColumn>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    // Students management modal state
    const [showStudentsModal, setShowStudentsModal] = useState(false);
    const [managingClass, setManagingClass] = useState<Clase | null>(null);
    const [studentSearchTerm, setStudentSearchTerm] = useState('');
    const [savingStudents, setSavingStudents] = useState(false);
    const [smartFilterActive, setSmartFilterActive] = useState(true);

    // Rooms management modal state
    const [showRoomsModal, setShowRoomsModal] = useState(false);
    const [managingClassForRoom, setManagingClassForRoom] = useState<Clase | null>(null);
    const [roomSearchTerm, setRoomSearchTerm] = useState('');
    const [savingRoom, setSavingRoom] = useState(false);

    // Import state
    const [showImportModal, setShowImportModal] = useState(false);

    // Edit modal student search
    const [editModalStudentSearch, setEditModalStudentSearch] = useState('');

    // Delete confirmation state
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Merge classes state
    const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [merging, setMerging] = useState(false);
    const [mergeName, setMergeName] = useState('');
    const [mergeInstruments, setMergeInstruments] = useState<string[]>([]);

    // Load all data from Firestore
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [classesData, teachersData, roomsData, studentsData] = await Promise.all([
                clasesService.getAllClases(),
                maestrosService.getAllMaestros(),
                salonesService.getAllSalones(),
                alumnosService.getAllStudents()
            ]);
            setClasses(classesData);
            setTeachers(teachersData);
            setRooms(roomsData);
            setStudents(studentsData);
        } catch (err: any) {
            console.error('Error loading data:', err);
            setError('Error al cargar datos. Verifica la conexión con Firebase.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Helper functions - support both new and legacy field names
    const getTeacherName = (clase: Partial<Clase>): string => {
        // Try new field first
        if (clase.teacherId) {
            const teacher = teachers.find(t => t.id === clase.teacherId);
            if (teacher) return teacher.name;
        }
        // Try legacy profesor_id
        if (clase.profesor_id) {
            const teacher = teachers.find(t => t.id === clase.profesor_id);
            if (teacher) return teacher.name;
        }
        // Try legacy profesor_nombre
        if (clase.profesor_nombre) {
            return clase.profesor_nombre;
        }
        // Try legacy array (first teacher)
        if (clase.profesor_ids && clase.profesor_ids.length > 0) {
            const teacher = teachers.find(t => t.id === clase.profesor_ids![0]);
            if (teacher) return teacher.name;
        }
        if (clase.profesor_nombres && clase.profesor_nombres.length > 0) {
            return clase.profesor_nombres[0];
        }
        return 'Sin asignar';
    };

    const getTeacherId = (clase: Partial<Clase>): string => {
        return clase.teacherId || clase.profesor_id || clase.profesor_ids?.[0] || '';
    };

    // Legacy-compatible room helper
    const getRoomId = (clase: Partial<Clase>): string => {
        return clase.roomId || clase.salon_id || '';
    };

    const getRoomName = (clase: Partial<Clase>): string => {
        const roomId = getRoomId(clase);
        if (clase.salon_nombre) return clase.salon_nombre;
        if (!roomId) return 'Sin salón';
        const room = rooms.find(r => r.id === roomId);
        const name = room?.nombre || room?.name || 'Sin salón';
        return typeof name === 'string' ? name : (name as any)?.nombre || 'Sin salón';
    };

    // Legacy-compatible schedule helper
    const getScheduleDisplay = (clase: Partial<Clase>): string => {
        // Try new format first
        if (clase.schedule?.slots && clase.schedule.slots.length > 0) {
            const grouped: Record<string, string[]> = {};
            clase.schedule.slots.forEach(slot => {
                const timeStr = `${slot.startTime}-${slot.endTime}`;
                if (!grouped[timeStr]) grouped[timeStr] = [];
                grouped[timeStr].push(slot.day.substring(0, 3));
            });
            return Object.entries(grouped)
                .map(([time, days]) => `${days.join('/')} ${time}`)
                .join(', ');
        }
        // Try legacy horarios array
        if (clase.horarios && clase.horarios.length > 0) {
            return clase.horarios.map(h => {
                const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                const dayName = dayNames[h.dia] || `D${h.dia}`;
                return `${dayName} ${h.hora_inicio}-${h.hora_fin}`;
            }).join(', ');
        }
        // Try legacy single schedule
        if (clase.dia && clase.hora_inicio && clase.hora_fin) {
            return `${clase.dia.substring(0, 3)} ${clase.hora_inicio}-${clase.hora_fin}`;
        }
        if (clase.dias && clase.dias.length > 0 && clase.hora_inicio && clase.hora_fin) {
            return `${clase.dias.map(d => d.substring(0, 3)).join('/')} ${clase.hora_inicio}-${clase.hora_fin}`;
        }
        return 'Sin horario';
    };

    // Legacy-compatible student count helper
    const getStudentCount = (clase: Partial<Clase>): number => {
        return (clase.studentIds || clase.alumno_ids || clase.alumnos || []).length;
    };

    const getStudentIds = (clase: Partial<Clase>): string[] => {
        return clase.studentIds || clase.alumno_ids || clase.alumnos || [];
    };

    // Legacy-compatible name helper
    const getClassName = (clase: Partial<Clase>): string => {
        return clase.name || clase.nombre || 'Sin nombre';
    };

    // Legacy-compatible status helper
    const getClassStatus = (clase: Partial<Clase>): string => {
        if (clase.status) return clase.status;
        if (clase.activo === true) return 'active';
        if (clase.activo === false) return 'inactive';
        return 'active';
    };

    // Alumno helpers
    const getStudentFullName = (student: Alumno): string => {
        return `${student.nombre || ''} ${student.apellido || ''}`.trim() || 'Sin nombre';
    };

    const getStudentInstrument = (student: Alumno): string => {
        if (!student.instrumento) return '';
        if (typeof student.instrumento === 'string') return student.instrumento;
        return (student.instrumento as any).nombre || '';
    };

    const getStudentInitials = (student: Alumno): string => {
        const namePart = (student.nombre || '').substring(0, 1);
        const lastNamePart = (student.apellido || '').substring(0, 1);
        return (namePart + lastNamePart).toUpperCase() || 'AL';
    };

    // Filter classes
    const filteredClasses = useMemo(() => {
        return classes.filter(c => {
            const className = getClassName(c);
            const teacherName = getTeacherName(c);
            const classStatus = getClassStatus(c);
            const teacherId = getTeacherId(c);

            const matchesSearch = !searchTerm ||
                className.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.instrument || c.instrumento || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
                teacherName.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = !filterStatus || classStatus === filterStatus;
            const matchesTeacher = !filterTeacher || teacherId === filterTeacher;

            return matchesSearch && matchesStatus && matchesTeacher;
        });
    }, [classes, searchTerm, filterStatus, filterTeacher, teachers]);

    // Sort classes
    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const sortedClasses = useMemo(() => {
        if (!sortColumn) return filteredClasses;

        return [...filteredClasses].sort((a, b) => {
            let comparison = 0;

            switch (sortColumn) {
                case 'name':
                    comparison = getClassName(a).localeCompare(getClassName(b), 'es');
                    break;
                case 'teacher':
                    comparison = getTeacherName(a).localeCompare(getTeacherName(b), 'es');
                    break;
                case 'students':
                    comparison = getStudentCount(a) - getStudentCount(b);
                    break;
                case 'room':
                    comparison = getRoomName(a).localeCompare(getRoomName(b), 'es');
                    break;
                case 'status':
                    const statusOrder = { active: 0, inactive: 1, archived: 2 };
                    const statusA = getClassStatus(a) as keyof typeof statusOrder;
                    const statusB = getClassStatus(b) as keyof typeof statusOrder;
                    comparison = (statusOrder[statusA] || 0) - (statusOrder[statusB] || 0);
                    break;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [filteredClasses, sortColumn, sortDirection]);

    // Sortable header component
    const SortableHeader = ({
        column,
        label,
        className = ''
    }: {
        column: SortColumn;
        label: string;
        className?: string;
    }) => (
        <th
            className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none transition-colors ${className}`}
            onClick={() => handleSort(column)}
        >
            <div className="flex items-center gap-1">
                <span>{label}</span>
                {sortColumn === column ? (
                    sortDirection === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-indigo-500" />
                    ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
                    )
                ) : (
                    <div className="w-3.5 h-3.5" />
                )}
            </div>
        </th>
    );

    // Check for conflicts
    const checkConflicts = async () => {
        if (!editingClass) return;
        try {
            const results = await clasesService.detectConflicts(editingClass, editingId || undefined);
            setConflicts(results);
        } catch (err) {
            console.error('Error checking conflicts:', err);
        }
    };

    // Check conflicts when schedule, room, teacher, or students change
    useEffect(() => {
        if (showModal && editingClass) {
            const debounce = setTimeout(() => {
                checkConflicts();
            }, 500);
            return () => clearTimeout(debounce);
        }
    }, [editingClass?.schedule, editingClass?.roomId, editingClass?.teacherId, editingClass?.studentIds]);

    // Initialize merge modal values when opening
    useEffect(() => {
        if (showMergeModal && selectedClassIds.size > 0) {
            const selectedClasses = classes.filter(c => selectedClassIds.has(c.id));
            if (selectedClasses.length > 0) {
                // Set name from first class
                setMergeName(selectedClasses[0]?.name || '');

                // Collect all unique instruments
                const allInstruments = Array.from(new Set(selectedClasses.flatMap(c =>
                    c.instruments?.length ? c.instruments : (c.instrument ? [c.instrument] : [])
                )));
                setMergeInstruments(allInstruments);
            }
        }
    }, [showMergeModal, selectedClassIds, classes]);

    // Open edit modal automatically when ?edit=CLASS_ID is in URL
    useEffect(() => {
        const editClassId = searchParams.get('edit');
        if (editClassId && classes.length > 0 && !showModal) {
            const classToEdit = classes.find(c => c.id === editClassId);
            if (classToEdit) {
                setEditingClass(classToEdit);
                setShowModal(true);
                // Remove the query parameter after opening
                setSearchParams({});
            }
        }
    }, [searchParams, classes, showModal, setSearchParams]);

    // Modal handlers
    const openNewClass = () => {
        setEditingClass({
            name: '',
            description: '',
            instrument: '',
            status: 'active',
            teacherId: '',
            sharedWith: [],
            permissions: {},
            studentIds: [],
            roomId: '',
            schedule: { slots: [] }
        });
        setEditingId(null);
        setConflicts([]);
        setError(null);
        setActiveTab('info');
        setShowModal(true);
    };

    const openEditClass = (clase: Clase) => {
        setEditingClass({ ...clase });
        setEditingId(clase.id);
        setConflicts([]);
        setError(null);
        setActiveTab('info');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingClass(null);
        setEditingId(null);
        setConflicts([]);
        setError(null);
        setEditModalStudentSearch('');
    };

    const updateField = (field: keyof Clase, value: any) => {
        if (editingClass) {
            setEditingClass({ ...editingClass, [field]: value });
        }
    };

    // Schedule slot handlers
    const addScheduleSlot = () => {
        if (!editingClass) return;
        const slots = editingClass.schedule?.slots || [];
        updateField('schedule', {
            slots: [...slots, { day: 'Lunes', startTime: '09:00', endTime: '10:00' }]
        });
    };

    const updateScheduleSlot = (index: number, field: keyof ScheduleSlot, value: string) => {
        if (!editingClass?.schedule?.slots) return;
        const newSlots = [...editingClass.schedule.slots];
        newSlots[index] = { ...newSlots[index], [field]: value };
        updateField('schedule', { slots: newSlots });
    };

    const removeScheduleSlot = (index: number) => {
        if (!editingClass?.schedule?.slots) return;
        const newSlots = editingClass.schedule.slots.filter((_, i) => i !== index);
        updateField('schedule', { slots: newSlots });
    };

    // Student selection handlers (for edit modal)
    const toggleStudent = (studentId: string) => {
        if (!editingClass) return;
        const current = editingClass.studentIds || [];
        if (current.includes(studentId)) {
            updateField('studentIds', current.filter(id => id !== studentId));
        } else {
            updateField('studentIds', [...current, studentId]);
        }
    };

    // Student management modal handlers
    const openStudentsModal = (clase: Clase) => {
        setManagingClass({ ...clase });
        setStudentSearchTerm('');
        setSmartFilterActive(true); // Default to smart filter enabled
        setShowStudentsModal(true);
    };

    const closeStudentsModal = () => {
        setShowStudentsModal(false);
        setManagingClass(null);
        setStudentSearchTerm('');
    };

    // Room management modal handlers
    const openRoomsModal = (clase: Clase) => {
        setManagingClassForRoom({ ...clase });
        setRoomSearchTerm('');
        setShowRoomsModal(true);
    };

    const closeRoomsModal = () => {
        setShowRoomsModal(false);
        setManagingClassForRoom(null);
        setRoomSearchTerm('');
    };

    const selectRoomForClass = async (roomId: string) => {
        if (!managingClassForRoom) return;
        setSavingRoom(true);
        try {
            const selectedRoom = rooms.find(r => r.id === roomId);
            const roomName = selectedRoom?.nombre || 'Desconocido';

            await clasesService.updateWithHistory(
                managingClassForRoom.id,
                { roomId, salon_id: roomId, salon_nombre: roomName },
                `Salón actualizado a: ${roomName}`
            );
            await loadData();
            closeRoomsModal();
        } catch (err: any) {
            console.error('Error saving room:', err);
            setError(err.message || 'Error al actualizar el salón');
        } finally {
            setSavingRoom(false);
        }
    };

    const filteredRoomsForModal = useMemo(() => {
        if (!roomSearchTerm) return rooms;
        const term = roomSearchTerm.toLowerCase();
        return rooms.filter(r =>
            r.nombre.toLowerCase().includes(term) ||
            r.ubicacion?.toLowerCase().includes(term)
        );
    }, [rooms, roomSearchTerm]);

    const toggleStudentInClass = (studentId: string) => {
        if (!managingClass) return;
        const currentIds = getStudentIds(managingClass);
        let newIds: string[];

        if (currentIds.includes(studentId)) {
            newIds = currentIds.filter(id => id !== studentId);
        } else {
            newIds = [...currentIds, studentId];
        }

        setManagingClass({ ...managingClass, studentIds: newIds });
    };

    const saveStudentChanges = async () => {
        if (!managingClass) return;
        setSavingStudents(true);
        try {
            await clasesService.updateWithHistory(
                managingClass.id,
                { studentIds: managingClass.studentIds || [] },
                `Alumnos actualizados: ${managingClass.studentIds?.length || 0} inscritos`
            );
            await loadData();
            closeStudentsModal();
        } catch (err: any) {
            console.error('Error saving students:', err);
            setError(err.message || 'Error al guardar alumnos');
        } finally {
            setSavingStudents(false);
        }
    };

    // Smart filter helpers
    const getInstrumentSection = useCallback((instrumentName: string): string | null => {
        if (!instrumentName) return null;
        const lowerName = instrumentName.toLowerCase();
        for (const [section, instruments] of Object.entries(INSTRUMENT_SECTIONS)) {
            if (instruments.some(inst => lowerName.includes(inst.toLowerCase()))) {
                return section;
            }
        }
        return null;
    }, []);

    const inferredFilter = useMemo(() => {
        if (!managingClass) return null;

        // 1. Check instrument field
        const instrument = managingClass.instrument || managingClass.instrumento;
        if (instrument && typeof instrument === 'string') {
            return { type: 'instrument' as const, value: instrument, section: getInstrumentSection(instrument) };
        }

        // 2. Check name for sections
        const className = getClassName(managingClass).toLowerCase();
        for (const section of Object.keys(INSTRUMENT_SECTIONS)) {
            if (className.includes(section.toLowerCase())) {
                return { type: 'section' as const, value: section };
            }
        }

        // 3. Check name for specific instruments
        for (const [section, instruments] of Object.entries(INSTRUMENT_SECTIONS)) {
            for (const inst of instruments) {
                if (className.includes(inst.toLowerCase())) {
                    return { type: 'instrument' as const, value: inst, section };
                }
            }
        }

        return null;
    }, [managingClass, getInstrumentSection]);

    // Filtered students for management modal
    const filteredStudentsForModal = useMemo(() => {
        let list = students;

        // Apply search term if any
        if (studentSearchTerm) {
            const term = studentSearchTerm.toLowerCase();
            list = list.filter(s =>
                getStudentFullName(s).toLowerCase().includes(term) ||
                getStudentInstrument(s).toLowerCase().includes(term)
            );
        }

        // Apply smart filter if active
        if (smartFilterActive && inferredFilter) {
            list = list.filter(s => {
                const sInst = getStudentInstrument(s).toLowerCase();

                if (inferredFilter.type === 'instrument') {
                    // Match instrument or similar
                    const target = inferredFilter.value.toLowerCase();
                    if (sInst.includes(target) || target.includes(sInst)) return true;

                    // Also match instrument section if found
                    const sSection = getInstrumentSection(sInst);
                    return sSection === inferredFilter.section;
                } else if (inferredFilter.type === 'section') {
                    // Match instrument section
                    const sSection = getInstrumentSection(sInst);
                    return sSection === inferredFilter.value;
                }

                return false;
            });
        }

        return list;
    }, [students, studentSearchTerm, smartFilterActive, inferredFilter, getInstrumentSection]);

    // Shared teacher handlers
    const toggleSharedTeacher = (teacherId: string) => {
        if (!editingClass || teacherId === editingClass.teacherId) return;
        const current = editingClass.sharedWith || [];
        if (current.includes(teacherId)) {
            updateField('sharedWith', current.filter(id => id !== teacherId));
            // Remove permissions too
            const newPerms = { ...editingClass.permissions };
            delete newPerms[teacherId];
            updateField('permissions', newPerms);
        } else {
            updateField('sharedWith', [...current, teacherId]);
            // Add default permissions
            updateField('permissions', {
                ...editingClass.permissions,
                [teacherId]: ['attendance', 'observations']
            });
        }
    };

    // Save class
    const handleSave = async () => {
        if (!editingClass?.name?.trim()) {
            setError('El nombre de la clase es requerido');
            return;
        }
        if (!editingClass?.teacherId) {
            setError('Debes seleccionar un maestro');
            return;
        }

        // Warn about conflicts but allow saving
        if (conflicts.length > 0) {
            if (!confirm(`Hay ${conflicts.length} conflicto(s) detectados. ¿Deseas guardar de todas formas?`)) {
                return;
            }
        }

        setSaving(true);
        setError(null);

        try {
            if (editingId) {
                await clasesService.updateWithHistory(
                    editingId,
                    editingClass,
                    'Clase actualizada',
                    undefined // userId would come from auth context
                );
            } else {
                await clasesService.createWithHistory(
                    editingClass as Omit<Clase, 'id'>,
                    undefined
                );
            }
            await loadData();
            closeModal();
        } catch (err: any) {
            console.error('Error saving class:', err);
            setError(err.message || 'Error al guardar la clase');
        } finally {
            setSaving(false);
        }
    };

    // Delete class
    const handleDelete = async (id: string) => {
        setDeleting(true);
        try {
            await clasesService.delete(id);
            await loadData();
            setConfirmDeleteId(null);
        } catch (err: any) {
            console.error('Error deleting class:', err);
            setError(err.message || 'Error al eliminar la clase');
        } finally {
            setDeleting(false);
        }
    };

    // Quick add handlers
    const handleQuickAdd = async () => {
        if (!quickAddType || !quickAddData.name?.trim()) return;

        try {
            if (quickAddType === 'teacher') {
                const id = await maestrosService.create({
                    name: quickAddData.name,
                    primaryInstrument: quickAddData.instrument || '',
                    status: 'active',
                    phone: '',
                    sharedWith: [],
                    permissions: {},
                    studentIds: [],
                    schedule: { slots: [] }
                } as any);
                await loadData();
                updateField('teacherId', id);
            } else if (quickAddType === 'student') {
                const id = await alumnosService.create({
                    nombre: quickAddData.name,
                    instrumento: quickAddData.instrument || '',
                    estado: 'activo'
                } as any);
                await loadData();
                toggleStudent(id);
            } else if (quickAddType === 'room') {
                const id = await salonesService.create({
                    nombre: quickAddData.name,
                    capacidad: parseInt(quickAddData.capacity) || 20,
                    activo: true
                } as any);
                await loadData();
                updateField('roomId', id);
            }
            setQuickAddType(null);
            setQuickAddData({});
        } catch (err: any) {
            console.error('Error in quick add:', err);
            setError(err.message || 'Error al crear');
        }
    };

    // Get status badge
    const getStatusBadge = (status: string) => {
        const config = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[1];
        const colors = {
            green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
            gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
            red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
        };
        return (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[config.color as keyof typeof colors]}`}>
                {config.label}
            </span>
        );
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <BookOpen className="w-7 h-7 text-indigo-500" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                Clases
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {classes.length} clases registradas
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={loadData}
                            className="p-2.5 bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 shadow-sm"
                            title="Recargar"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-95 shadow-sm"
                            title="Importación masiva (CSV)"
                        >
                            <FileText className="w-5 h-5" />
                            <span className="hidden sm:inline font-medium">Importar CSV</span>
                        </button>
                        {selectedClassIds.size >= 2 && (
                            <button
                                onClick={() => setShowMergeModal(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                title={`Fusionar ${selectedClassIds.size} clases seleccionadas`}
                            >
                                <Users className="w-5 h-5" />
                                <span className="hidden sm:inline">Fusionar ({selectedClassIds.size})</span>
                            </button>
                        )}
                        <button
                            onClick={openNewClass}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="hidden sm:inline">Nueva Clase</span>
                        </button>
                    </div>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="sm:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, instrumento, maestro..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <select
                            value={filterTeacher}
                            onChange={(e) => setFilterTeacher(e.target.value)}
                            className="px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">Todos los maestros</option>
                            {teachers.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">Todos los estados</option>
                            {STATUS_OPTIONS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Classes Table */}
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                ) : sortedClasses.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-900/50">
                                    <tr>
                                        <th className="px-4 py-3 w-12">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                                                checked={selectedClassIds.size > 0 && selectedClassIds.size === sortedClasses.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedClassIds(new Set(sortedClasses.map(c => c.id)));
                                                    } else {
                                                        setSelectedClassIds(new Set());
                                                    }
                                                }}
                                                title="Seleccionar todas"
                                            />
                                        </th>
                                        <SortableHeader column="name" label="Clase" />
                                        <SortableHeader column="teacher" label="Maestro" className="hidden md:table-cell" />
                                        <SortableHeader column="students" label="Alumnos" className="hidden sm:table-cell" />
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">Horario</th>
                                        <SortableHeader column="room" label="Salón" className="hidden md:table-cell" />
                                        <SortableHeader column="status" label="Estado" />
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {sortedClasses.map(clase => (
                                        <tr
                                            key={clase.id}
                                            className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${clase.status !== 'active' ? 'opacity-60' : ''} ${selectedClassIds.has(clase.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                                        >
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                                                    checked={selectedClassIds.has(clase.id)}
                                                    onChange={(e) => {
                                                        const newSelected = new Set(selectedClassIds);
                                                        if (e.target.checked) {
                                                            newSelected.add(clase.id);
                                                        } else {
                                                            newSelected.delete(clase.id);
                                                        }
                                                        setSelectedClassIds(newSelected);
                                                    }}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                                        <Music className="w-5 h-5 text-indigo-500" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-800 dark:text-gray-200">
                                                            {clase.name}
                                                        </div>
                                                        {(() => {
                                                            const instruments = clase.instruments?.length
                                                                ? clase.instruments.join(', ')
                                                                : clase.instrument || '';
                                                            return instruments && (
                                                                <div className="text-xs text-gray-500">
                                                                    {instruments}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        {getTeacherName(clase)}
                                                    </span>
                                                    {clase.sharedWith && clase.sharedWith.length > 0 && (
                                                        <span className="text-xs text-indigo-500" title="Clase compartida">
                                                            <Share2 className="w-3 h-3" />
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td
                                                className="px-4 py-3 hidden sm:table-cell cursor-pointer group"
                                                onClick={() => openStudentsModal(clase)}
                                            >
                                                <div className="flex items-center gap-2 group-hover:text-indigo-500 transition-colors">
                                                    <Users className="w-4 h-4 text-gray-400 group-hover:text-indigo-400" />
                                                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                                                        {getStudentCount(clase)} alumnos
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 hidden lg:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-gray-400" />
                                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                                        {getScheduleDisplay(clase)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td
                                                className="px-4 py-3 hidden md:table-cell cursor-pointer group"
                                                onClick={() => openRoomsModal(clase)}
                                            >
                                                <div className="flex items-center gap-2 group-hover:text-indigo-500 transition-colors">
                                                    <MapPin className="w-4 h-4 text-gray-400 group-hover:text-indigo-400" />
                                                    <div className="flex flex-col">
                                                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                                                            {getRoomName(clase)}
                                                        </span>
                                                        {clase.roomId && rooms.find(r => r.id === clase.roomId)?.capacidad && (
                                                            <span className="text-[10px] text-gray-400">
                                                                Cap: {rooms.find(r => r.id === clase.roomId)?.capacidad} pers.
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        {getRoomName(clase)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {getStatusBadge(getClassStatus(clase))}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => navigate(`/attendance?classId=${clase.id}`)}
                                                        className="p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                                        title="Ver Asistencia"
                                                    >
                                                        <ClipboardCheck className="w-4 h-4 text-green-500" />
                                                    </button>
                                                    <button
                                                        onClick={() => openEditClass(clase)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4 text-blue-500" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(clase.id); }}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No se encontraron clases</p>
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="mt-2 text-indigo-500 hover:underline"
                            >
                                Limpiar búsqueda
                            </button>
                        )}
                    </div>
                )}

                {/* Edit/Create Modal */}
                {showModal && editingClass && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                                    {editingId ? 'Editar Clase' : 'Nueva Clase'}
                                </h2>
                                <button onClick={closeModal}>
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            {/* Conflict Warning */}
                            {conflicts.length > 0 && (
                                <div className="mx-4 mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium mb-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        {conflicts.length} Conflicto(s) Detectados
                                    </div>
                                    <ul className="text-sm text-amber-600 dark:text-amber-400 space-y-1">
                                        {conflicts.slice(0, 3).map((c, i) => (
                                            <li key={i}>• {c.day} {c.time}: {c.details}</li>
                                        ))}
                                        {conflicts.length > 3 && (
                                            <li>...y {conflicts.length - 3} más</li>
                                        )}
                                    </ul>
                                </div>
                            )}

                            {/* Tabs */}
                            <div className="flex border-b dark:border-gray-700 px-4">
                                {(['info', 'schedule', 'students', 'sharing'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                            }`}
                                    >
                                        {tab === 'info' && 'Info General'}
                                        {tab === 'schedule' && 'Horario'}
                                        {tab === 'students' && `Alumnos (${editingClass.studentIds?.length || 0})`}
                                        {tab === 'sharing' && 'Compartir'}
                                    </button>
                                ))}
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-4">
                                {/* Info Tab */}
                                {activeTab === 'info' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Nombre de la Clase *
                                            </label>
                                            <input
                                                type="text"
                                                value={editingClass.name || ''}
                                                onChange={(e) => updateField('name', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                placeholder="Ej: Violín Nivel 1"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Instrumento(s)
                                            </label>

                                            {/* Display current instruments */}
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {(() => {
                                                    const currentInstruments = editingClass.instruments?.length
                                                        ? editingClass.instruments
                                                        : (editingClass.instrument ? [editingClass.instrument] : []);

                                                    return currentInstruments.map((inst, index) => (
                                                        <span
                                                            key={index}
                                                            className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium"
                                                        >
                                                            {inst}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const updated = currentInstruments.filter((_, i) => i !== index);
                                                                    updateField('instruments', updated.length > 0 ? updated : undefined);
                                                                    // Keep legacy field in sync
                                                                    if (updated.length === 1) {
                                                                        updateField('instrument', updated[0]);
                                                                    } else {
                                                                        updateField('instrument', '');
                                                                    }
                                                                }}
                                                                className="hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full p-0.5"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    ));
                                                })()}
                                            </div>

                                            {/* Input to add new instrument */}
                                            <input
                                                type="text"
                                                placeholder="Agregar instrumento... (presiona Enter)"
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const value = e.currentTarget.value.trim();
                                                        if (value) {
                                                            const current = editingClass.instruments?.length
                                                                ? editingClass.instruments
                                                                : (editingClass.instrument ? [editingClass.instrument] : []);

                                                            if (!current.includes(value)) {
                                                                const updated = [...current, value];
                                                                updateField('instruments', updated);
                                                                // Keep legacy field in sync with first instrument
                                                                if (updated.length === 1) {
                                                                    updateField('instrument', updated[0]);
                                                                }
                                                            }
                                                            e.currentTarget.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                Escribe el nombre y presiona Enter para agregar múltiples instrumentos
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Maestro Titular *
                                            </label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={editingClass.teacherId || ''}
                                                    onChange={(e) => updateField('teacherId', e.target.value)}
                                                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                >
                                                    <option value="">Seleccionar maestro...</option>
                                                    {teachers.filter(t => t.status === 'active').map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => setQuickAddType('teacher')}
                                                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                                                    title="Agregar nuevo maestro"
                                                >
                                                    <UserPlus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Salón
                                            </label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={editingClass.roomId || ''}
                                                    onChange={(e) => updateField('roomId', e.target.value)}
                                                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                >
                                                    <option value="">Seleccionar salón...</option>
                                                    {rooms.filter(r => r.activo !== false).map(r => (
                                                        <option key={r.id} value={r.id}>{r.nombre || r.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => setQuickAddType('room')}
                                                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                                                    title="Agregar nuevo salón"
                                                >
                                                    <Home className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Descripción
                                            </label>
                                            <textarea
                                                value={editingClass.description || ''}
                                                onChange={(e) => updateField('description', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                rows={3}
                                                placeholder="Descripción opcional..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Estado
                                            </label>
                                            <select
                                                value={editingClass.status || 'active'}
                                                onChange={(e) => updateField('status', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                            >
                                                {STATUS_OPTIONS.map(s => (
                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* Schedule Tab */}
                                {activeTab === 'schedule' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-medium text-gray-800 dark:text-gray-200">
                                                Horarios de Clase
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={addScheduleSlot}
                                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Agregar Horario
                                            </button>
                                        </div>

                                        {editingClass.schedule?.slots && editingClass.schedule.slots.length > 0 ? (
                                            <div className="space-y-3">
                                                {editingClass.schedule.slots.map((slot, index) => (
                                                    <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                        <select
                                                            value={slot.day}
                                                            onChange={(e) => updateScheduleSlot(index, 'day', e.target.value)}
                                                            className="flex-1 px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                        >
                                                            {DAYS.map(d => (
                                                                <option key={d} value={d}>{d}</option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="time"
                                                            value={slot.startTime}
                                                            onChange={(e) => updateScheduleSlot(index, 'startTime', e.target.value)}
                                                            className="px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                        />
                                                        <span className="text-gray-500">-</span>
                                                        <input
                                                            type="time"
                                                            value={slot.endTime}
                                                            onChange={(e) => updateScheduleSlot(index, 'endTime', e.target.value)}
                                                            className="px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeScheduleSlot(index)}
                                                            className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm">No hay horarios definidos</p>
                                                <p className="text-xs">Agrega al menos un horario para esta clase</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Students Tab */}
                                {activeTab === 'students' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-medium text-gray-800 dark:text-gray-200">
                                                Alumnos Inscritos ({editingClass.studentIds?.length || 0})
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => setQuickAddType('student')}
                                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                                            >
                                                <UserPlus className="w-4 h-4" />
                                                Nuevo Alumno
                                            </button>
                                        </div>

                                        {/* Search Field */}
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar alumno por nombre..."
                                                value={editModalStudentSearch}
                                                onChange={(e) => setEditModalStudentSearch(e.target.value)}
                                                className="w-full pl-10 pr-10 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            {editModalStudentSearch && (
                                                <button
                                                    onClick={() => setEditModalStudentSearch('')}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full"
                                                >
                                                    <X className="w-3 h-3 text-gray-400" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="max-h-64 overflow-y-auto border dark:border-gray-700 rounded-lg divide-y dark:divide-gray-700">
                                            {students.length === 0 ? (
                                                <div className="text-center py-8 text-gray-500">
                                                    No hay alumnos registrados
                                                </div>
                                            ) : (() => {
                                                const filteredStudents = students.filter(student => {
                                                    if (!editModalStudentSearch.trim()) return true;
                                                    const searchLower = editModalStudentSearch.toLowerCase();
                                                    const fullName = getStudentFullName(student).toLowerCase();
                                                    const instrument = getStudentInstrument(student)?.toLowerCase() || '';
                                                    return fullName.includes(searchLower) || instrument.includes(searchLower);
                                                });

                                                // Sort: selected students first, then alphabetically
                                                const sortedStudents = filteredStudents.sort((a, b) => {
                                                    const aSelected = editingClass.studentIds?.includes(a.id) || false;
                                                    const bSelected = editingClass.studentIds?.includes(b.id) || false;

                                                    // Selected first
                                                    if (aSelected && !bSelected) return -1;
                                                    if (!aSelected && bSelected) return 1;

                                                    // Then alphabetically
                                                    return getStudentFullName(a).localeCompare(getStudentFullName(b));
                                                });

                                                if (filteredStudents.length === 0) {
                                                    return (
                                                        <div className="text-center py-8 text-gray-500">
                                                            <p>No se encontraron alumnos</p>
                                                            <button
                                                                onClick={() => setEditModalStudentSearch('')}
                                                                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
                                                            >
                                                                Limpiar búsqueda
                                                            </button>
                                                        </div>
                                                    );
                                                }

                                                return sortedStudents.map(student => {
                                                    const isSelected = editingClass.studentIds?.includes(student.id);
                                                    return (
                                                        <label
                                                            key={student.id}
                                                            className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleStudent(student.id)}
                                                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                            />
                                                            <div className="flex-1">
                                                                <div className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                                                                    {getStudentFullName(student)}
                                                                </div>
                                                                {getStudentInstrument(student) && (
                                                                    <div className="text-xs text-gray-500">
                                                                        {getStudentInstrument(student)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {isSelected && (
                                                                <CheckCircle className="w-4 h-4 text-indigo-500" />
                                                            )}
                                                        </label>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Sharing Tab */}
                                {activeTab === 'sharing' && (
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                                                Compartir con otros maestros
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                                Los maestros invitados pueden registrar asistencia y observaciones.
                                            </p>
                                        </div>

                                        <div className="max-h-64 overflow-y-auto border dark:border-gray-700 rounded-lg divide-y dark:divide-gray-700">
                                            {teachers.filter(t => t.id !== editingClass.teacherId && t.status === 'active').map(teacher => {
                                                const isShared = editingClass.sharedWith?.includes(teacher.id);
                                                return (
                                                    <label
                                                        key={teacher.id}
                                                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isShared ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isShared}
                                                            onChange={() => toggleSharedTeacher(teacher.id)}
                                                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                                                                {teacher.name}
                                                            </div>
                                                            {teacher.primaryInstrument && (
                                                                <div className="text-xs text-gray-500">
                                                                    {teacher.primaryInstrument}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {isShared && (
                                                            <Share2 className="w-4 h-4 text-indigo-500" />
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-2 p-4 border-t dark:border-gray-700">
                                <button
                                    onClick={closeModal}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg disabled:opacity-50"
                                >
                                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Quick Add Modal */}
                {quickAddType && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm">
                            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                                <h3 className="font-bold text-gray-800 dark:text-gray-100">
                                    {quickAddType === 'teacher' && 'Agregar Maestro'}
                                    {quickAddType === 'student' && 'Agregar Alumno'}
                                    {quickAddType === 'room' && 'Agregar Salón'}
                                </h3>
                                <button onClick={() => { setQuickAddType(null); setQuickAddData({}); }}>
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Nombre *
                                    </label>
                                    <input
                                        type="text"
                                        value={quickAddData.name || ''}
                                        onChange={(e) => setQuickAddData({ ...quickAddData, name: e.target.value })}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                        placeholder="Nombre..."
                                        autoFocus
                                    />
                                </div>
                                {(quickAddType === 'teacher' || quickAddType === 'student') && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Instrumento
                                        </label>
                                        <input
                                            type="text"
                                            value={quickAddData.instrument || ''}
                                            onChange={(e) => setQuickAddData({ ...quickAddData, instrument: e.target.value })}
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                            placeholder="Instrumento..."
                                        />
                                    </div>
                                )}
                                {quickAddType === 'room' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Capacidad
                                        </label>
                                        <input
                                            type="number"
                                            value={quickAddData.capacity || ''}
                                            onChange={(e) => setQuickAddData({ ...quickAddData, capacity: e.target.value })}
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                            placeholder="20"
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-end gap-2 p-4 border-t dark:border-gray-700">
                                <button
                                    onClick={() => { setQuickAddType(null); setQuickAddData({}); }}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleQuickAdd}
                                    disabled={!quickAddData.name?.trim()}
                                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg disabled:opacity-50"
                                >
                                    Agregar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Student Management Modal */}
                {showStudentsModal && managingClass && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border dark:border-gray-700 animate-in fade-in zoom-in duration-200">
                            {/* Modal Header */}
                            <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-indigo-500" />
                                        Gestionar Alumnos
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Clase: <span className="font-semibold text-gray-700 dark:text-gray-200">{getClassName(managingClass)}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={closeStudentsModal}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
                                >
                                    <X className="w-6 h-6 text-gray-500" />
                                </button>
                            </div>

                            {/* Search & Filter Bar */}
                            <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800/50 flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar alumnos..."
                                        value={studentSearchTerm}
                                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-10 py-3 border dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    />
                                    {studentSearchTerm && (
                                        <button
                                            onClick={() => setStudentSearchTerm('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full"
                                        >
                                            <X className="w-4 h-4 text-gray-400" />
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={() => setSmartFilterActive(!smartFilterActive)}
                                    className={`
                                        flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all font-medium
                                        ${smartFilterActive
                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm'
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                        }
                                    `}
                                    title={smartFilterActive ? 'Mostrar todos los alumnos' : 'Filtrar por instrumento/sección'}
                                >
                                    <Sparkles className={`w-5 h-5 ${smartFilterActive ? 'text-indigo-500 animate-pulse' : 'text-gray-400'}`} />
                                    <span className="whitespace-nowrap">
                                        {smartFilterActive ? 'Filtro Sugerido' : 'Ver Todos'}
                                    </span>
                                </button>
                            </div>

                            {/* Active Filter Info */}
                            {smartFilterActive && inferredFilter && (
                                <div className="px-6 py-2 bg-indigo-50/50 dark:bg-indigo-900/10 border-b dark:border-gray-700 flex items-center gap-2 overflow-x-auto no-scrollbar">
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-500 dark:text-indigo-400 whitespace-nowrap">Sugerencia inteligente:</span>
                                    <div className="flex gap-1.5">
                                        <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium whitespace-nowrap">
                                            {inferredFilter.type === 'instrument' ? `Instrumento: ${inferredFilter.value}` : `Sección: ${inferredFilter.value}`}
                                        </span>
                                        {inferredFilter.type === 'instrument' && inferredFilter.section && (
                                            <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-medium border border-indigo-100 dark:border-indigo-900/30 whitespace-nowrap">
                                                {inferredFilter.section}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Students List */}
                            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/20">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {filteredStudentsForModal.length > 0 ? (
                                        filteredStudentsForModal.map(student => {
                                            const isSelected = getStudentIds(managingClass).includes(student.id);
                                            return (
                                                <div
                                                    key={student.id}
                                                    onClick={() => toggleStudentInClass(student.id)}
                                                    className={`
                                                        p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-center gap-3
                                                        ${isSelected
                                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm'
                                                            : 'border-white dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-indigo-200 dark:hover:border-indigo-900/40'
                                                        }
                                                    `}
                                                >
                                                    <div className={`
                                                        w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                                                        ${isSelected
                                                            ? 'bg-indigo-500 text-white'
                                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                                        }
                                                    `}>
                                                        {getStudentInitials(student)}
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <div className="font-semibold text-gray-800 dark:text-gray-200 truncate text-sm">
                                                            {getStudentFullName(student)}
                                                        </div>
                                                        {getStudentInstrument(student) && (
                                                            <div className="text-xs text-gray-500 truncate mt-0.5">
                                                                {getStudentInstrument(student)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isSelected && (
                                                        <CheckCircle className="w-5 h-5 text-indigo-500 shrink-0" />
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400">
                                            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>No se encontraron alumnos</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
                                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {getStudentCount(managingClass)} alumnos seleccionados
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={closeStudentsModal}
                                        className="px-6 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={saveStudentChanges}
                                        disabled={savingStudents}
                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 transition-all active:scale-95 font-medium"
                                    >
                                        {savingStudents ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                <span>Guardando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" />
                                                <span>Guardar Cambios</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* Room Management Modal */}
                {showRoomsModal && managingClassForRoom && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border dark:border-gray-700 animate-in fade-in zoom-in duration-200">
                            {/* Modal Header */}
                            <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                        <Home className="w-5 h-5 text-indigo-500" />
                                        Asignar Salón
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Clase: <span className="font-semibold text-gray-700 dark:text-gray-200">{getClassName(managingClassForRoom)}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setQuickAddType('room')}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Nuevo Salón
                                    </button>
                                    <button
                                        onClick={closeRoomsModal}
                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
                                    >
                                        <X className="w-6 h-6 text-gray-500" />
                                    </button>
                                </div>
                            </div>

                            {/* Search Bar */}
                            <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800/50">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar salón por nombre o ubicación..."
                                        value={roomSearchTerm}
                                        onChange={(e) => setRoomSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        autoFocus
                                    />
                                    {roomSearchTerm && (
                                        <button
                                            onClick={() => setRoomSearchTerm('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full"
                                        >
                                            <X className="w-4 h-4 text-gray-400" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Rooms List */}
                            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/20">
                                <div className="grid grid-cols-1 gap-3">
                                    {filteredRoomsForModal.length > 0 ? (
                                        filteredRoomsForModal.map(room => {
                                            const isSelected = managingClassForRoom.roomId === room.id || managingClassForRoom.salon_id === room.id;
                                            return (
                                                <div
                                                    key={room.id}
                                                    onClick={() => !savingRoom && selectRoomForClass(room.id)}
                                                    className={`
                                                        p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-center gap-4
                                                        ${isSelected
                                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm'
                                                            : 'border-white dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-indigo-200 dark:hover:border-indigo-900/40'
                                                        }
                                                        ${savingRoom ? 'opacity-50 cursor-wait' : ''}
                                                    `}
                                                >
                                                    <div className={`
                                                        w-12 h-12 rounded-xl flex items-center justify-center
                                                        ${isSelected
                                                            ? 'bg-indigo-500 text-white'
                                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                                                        }
                                                    `}>
                                                        <Home className="w-6 h-6" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-gray-800 dark:text-gray-200">
                                                            {room.nombre}
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            {room.ubicacion && (
                                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" />
                                                                    {room.ubicacion}
                                                                </span>
                                                            )}
                                                            {room.capacidad && (
                                                                <span className="text-xs text-indigo-500 font-semibold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                                                                    {room.capacidad} pers.
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {isSelected && (
                                                        <CheckCircle className="w-6 h-6 text-indigo-500 shrink-0" />
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-12 text-center text-gray-500">
                                            <Home className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>No se encontraron salones</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t dark:border-gray-700 flex justify-end bg-white dark:bg-gray-800">
                                <button
                                    onClick={closeRoomsModal}
                                    className="px-6 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors font-medium"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Deletion Confirmation Modal */}
                {confirmDeleteId && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border dark:border-gray-700 animate-in zoom-in-95 duration-200">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                                Confirmar Eliminación
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                                ¿Estás seguro de que deseas eliminar esta clase por completo? Esta acción es permanente y no se puede deshacer.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    disabled={deleting}
                                    className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleDelete(confirmDeleteId)}
                                    disabled={deleting}
                                    className="flex-1 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-xl font-medium transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Merge Classes Modal */}
                {showMergeModal && (() => {
                    const selectedClasses = classes.filter(c => selectedClassIds.has(c.id));
                    const allStudentIds = Array.from(new Set(selectedClasses.flatMap(c => c.studentIds || [])));

                    const handleMerge = async () => {
                        setMerging(true);
                        setError(null);

                        try {
                            const result = await mergeClasses(Array.from(selectedClassIds), {
                                keepName: mergeName,
                                instruments: mergeInstruments,
                                dryRun: false
                            });

                            if (result.success) {
                                await loadData();
                                setSelectedClassIds(new Set());
                                setShowMergeModal(false);
                                setMergeName('');
                                setMergeInstruments([]);
                                // Success message could go here
                            } else {
                                setError(result.message || 'Error al fusionar clases');
                            }
                        } catch (err: any) {
                            setError(`Error inesperado: ${err.message}`);
                        } finally {
                            setMerging(false);
                        }
                    };

                    return (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                                <div className="p-6">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                                <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                                    Fusionar Clases
                                                </h2>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    Combinar {selectedClasses.length} clases en una sola
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowMergeModal(false)}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Clases a fusionar */}
                                    <div className="mb-6">
                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                            Clases Seleccionadas
                                        </h3>
                                        <div className="space-y-2">
                                            {selectedClasses.map(clase => (
                                                <div
                                                    key={clase.id}
                                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                                >
                                                    <div>
                                                        <div className="font-medium text-gray-800 dark:text-gray-200">
                                                            {clase.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {clase.instruments?.join(', ') || clase.instrument || 'Sin instrumento'}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                                        {clase.studentIds?.length || 0} alumnos
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Configuración de clase fusionada */}
                                    <div className="space-y-4 mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border-2 border-emerald-200 dark:border-emerald-800">
                                        <h3 className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-3">
                                            📋 Clase Resultante
                                        </h3>

                                        {/* Nombre */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Nombre de la clase
                                            </label>
                                            <input
                                                type="text"
                                                value={mergeName}
                                                onChange={(e) => setMergeName(e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                placeholder="Ej: Iniciación de Metales"
                                            />
                                        </div>

                                        {/* Instrumentos */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Instrumentos
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {mergeInstruments.map((inst, index) => (
                                                    <span
                                                        key={index}
                                                        className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium"
                                                    >
                                                        {inst}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setMergeInstruments(mergeInstruments.filter((_, i) => i !== index));
                                                            }}
                                                            className="hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full p-0.5"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Info resumen */}
                                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">Total Alumnos</div>
                                                <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                                                    {allStudentIds.length}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">Profesor</div>
                                                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                    {selectedClasses[0] ? getTeacherName(selectedClasses[0]) : 'No asignado'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Warning */}
                                    <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
                                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                        <div className="text-sm text-amber-800 dark:text-amber-300">
                                            <strong>Importante:</strong> Esta acción eliminará las clases seleccionadas y creará una nueva clase combinada. Los alumnos serán transferidos automáticamente.
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowMergeModal(false)}
                                            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                            disabled={merging}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleMerge}
                                            disabled={merging || !mergeName.trim() || mergeInstruments.length === 0}
                                            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {merging ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                    Fusionando...
                                                </>
                                            ) : (
                                                <>
                                                    <Users className="w-4 h-4" />
                                                    Fusionar Clases
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Bulk Import Modal */}
                {showImportModal && (
                    <BulkImportModal
                        onClose={() => setShowImportModal(false)}
                        onSuccess={() => {
                            loadData();
                            setShowImportModal(false);
                        }}
                    />
                )}
            </div>
        </div >
    );
};
