/**
 * StudentsPage - Student management
 * Connected directly to Firestore ALUMNOS collection
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    GraduationCap, Plus, Search, Edit2, Trash2,
    RefreshCw, X, Save, Phone, User, Calendar, MapPin, Mail,
    Music, School, FileText, AlertCircle, Users, Heart,
    ChevronUp, ChevronDown, PhoneOff, Cake, Check, Undo2
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alumno, AlumnoFormData, emptyAlumnoForm, alumnoToFormData, formDataToAlumno } from '../types/alumno';
import { alumnosService } from '../services/firestore';
import { InfoButton } from '../components/common/InfoButton';
import { usePageInfo } from '../hooks/useViewInfo';

// Note: Instrumentos are now dynamic from student data

// Grupos/Programas disponibles (basado en datos reales)
const GRUPOS_DISPONIBLES = [
    'Orquesta', 'Preparatoria', 'Coro', 'Camerata', 'Ensayo General',
    'Seccional Cuerdas', 'Seccionales', 'Individuales',
    'Solfeo1', 'Solfeo2', 'Solfeo3',
    'Taller Violines 1', 'Iniciación Musical'
];

// Helper to safely get instrument name (handles object or string)
const getInstrumentName = (instrumento: any): string => {
    if (!instrumento) return 'Sin asignar';
    if (typeof instrumento === 'string') return instrumento;
    if (typeof instrumento === 'object' && instrumento.nombre) return instrumento.nombre;
    return 'Sin asignar';
};

// Sort column type
type SortColumn = 'nombre' | 'edad' | 'instrumento' | 'contacto' | 'grupos' | 'estado' | null;
type SortDirection = 'asc' | 'desc';

// Inline editing types
type EditableField = 'nombre' | 'apellido' | 'instrumento' | 'tlf_madre' | 'tlf_padre' | 'tlf' | 'madre' | 'padre' | 'activo' | 'nac' | 'edad' | 'grupo';
type EditingCell = { studentId: string; field: EditableField } | null;
// Pending changes: Map<studentId, { field: newValue }>
type PendingChanges = Record<string, Partial<Alumno>>;

export const StudentsPage = () => {
    const pageInfo = usePageInfo('students');
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [students, setStudents] = useState<Alumno[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterInstrumento, setFilterInstrumento] = useState('');
    const [filterActivo, setFilterActivo] = useState<'' | 'true' | 'false'>('');
    const [filterPendientes, setFilterPendientes] = useState<'' | 'true' | 'false'>('');
    const [showModal, setShowModal] = useState(false);
    // Unused filters/states removed
    // const [selectedDay, setSelectedDay] = useState(new Date().getDay() || 1);
    // const [selectedClass, setSelectedClass] = useState<any | null>(null);
    // const [filterProgram, setFilterProgram] = useState('');
    // const [filterRoom, setFilterRoom] = useState('');

    // Modal state
    // const [showConflictsModal, setShowConflictsModal] = useState(false);
    // const [isDeleting, setIsDeleting] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [editingStudent, setEditingStudent] = useState<AlumnoFormData | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sorting state
    const [sortColumn, setSortColumn] = useState<SortColumn>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    // Inline editing state
    const [editingCell, setEditingCell] = useState<EditingCell>(null);
    const [pendingChanges, setPendingChanges] = useState<PendingChanges>({});
    const [savingInline, setSavingInline] = useState(false);
    const fromDiagnostics = searchParams.get('source') === 'attendance-diagnostics';
    const diagnosticReason = searchParams.get('reason') || '';
    const diagnosticId = searchParams.get('diagId') || '';

    const hasPendingChanges = Object.keys(pendingChanges).length > 0;
    const pendingCount = Object.keys(pendingChanges).length;

    // Get the display value for a field (pending change overrides original)
    const getDisplayValue = (student: Alumno, field: EditableField): string => {
        const changes = pendingChanges[student.id];
        if (changes && field in changes) {
            const val = changes[field];
            if (field === 'activo') return val ? 'true' : 'false';
            return String(val ?? '');
        }
        const val = student[field];
        if (val === undefined || val === null) return '';
        if (field === 'instrumento') return getInstrumentName(val);
        return String(val);
    };

    // Set a pending change for a field
    const setCellValue = (studentId: string, field: EditableField, value: any) => {
        setPendingChanges(prev => {
            const existing = prev[studentId] || {};
            return { ...prev, [studentId]: { ...existing, [field]: value } };
        });
    };

    // Start editing a cell
    const startEditing = (studentId: string, field: EditableField) => {
        setEditingCell({ studentId, field });
    };

    // Stop editing current cell
    const stopEditing = () => {
        setEditingCell(null);
    };

    // Discard all pending changes
    const discardChanges = () => {
        setPendingChanges({});
        setEditingCell(null);
    };

    // Save all pending changes to Firestore
    const saveAllChanges = async () => {
        if (!hasPendingChanges) return;
        setSavingInline(true);
        setError(null);
        try {
            const promises = Object.entries(pendingChanges).map(([studentId, changes]) =>
                alumnosService.update(studentId, changes)
            );
            await Promise.all(promises);
            setPendingChanges({});
            setEditingCell(null);
            await loadStudents();
        } catch (err: any) {
            console.error('Error saving inline changes:', err);
            setError(err.message || 'Error al guardar los cambios');
        } finally {
            setSavingInline(false);
        }
    };

    // Load students from Firestore
    const loadStudents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await alumnosService.getAllStudents();
            setStudents(data);
        } catch (err) {
            console.error('Error loading students:', err);
            setError('Error al cargar los alumnos. Verifica la conexión con Firebase.');
            setStudents([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStudents();
    }, [loadStudents]);

    useEffect(() => {
        const urlSearch = searchParams.get('search');
        if (urlSearch && urlSearch !== searchTerm) {
            setSearchTerm(urlSearch);
        }

        const editStudentId = searchParams.get('edit');
        if (editStudentId && students.length > 0 && !showModal) {
            const student = students.find(s => s.id === editStudentId);
            if (student) {
                setEditingStudent(alumnoToFormData(student));
                setEditingId(student.id);
                setError(null);
                setShowModal(true);
            }
            setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.delete('edit');
                return next;
            });
        }
    }, [searchParams, setSearchParams, students, showModal, searchTerm]);

    // Compute unique instruments from actual student data (dynamic filter)
    const uniqueInstruments = useMemo(() => {
        const instrumentSet = new Set<string>();
        students.forEach(student => {
            const name = getInstrumentName(student.instrumento);
            if (name && name !== 'Sin asignar') {
                instrumentSet.add(name);
            }
        });
        // Return sorted array
        return Array.from(instrumentSet).sort((a, b) => a.localeCompare(b, 'es'));
    }, [students]);

    // Save student (create or update)
    const handleSave = async () => {
        if (!editingStudent) return;

        // Validation - only nombre is required
        if (!editingStudent.nombre.trim()) {
            setError('El nombre es obligatorio');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const studentData = formDataToAlumno(editingStudent, editingId || undefined);

            if (editingId) {
                // Update existing student
                await alumnosService.update(editingId, studentData);
            } else {
                // Create new student - cast to required type
                await alumnosService.create(studentData as Omit<Alumno, 'id'>);
            }

            await loadStudents();
            closeModal();
        } catch (err: any) {
            console.error('Error saving student:', err);
            setError(err.message || 'Error al guardar el alumno');
        } finally {
            setSaving(false);
        }
    };

    // Delete student
    const handleDelete = async (id: string) => {
        setDeleting(true);
        try {
            await alumnosService.delete(id);
            await loadStudents();
            setConfirmDeleteId(null);
        } catch (err: any) {
            console.error('Error deleting student:', err);
            setError(err.message || 'Error al eliminar el alumno');
        } finally {
            setDeleting(false);
        }
    };

    // Modal handlers
    const openNewStudent = () => {
        setEditingStudent({ ...emptyAlumnoForm });
        setEditingId(null);
        setError(null);
        setShowModal(true);
    };

    const openEditStudent = (student: Alumno) => {
        setEditingStudent(alumnoToFormData(student));
        setEditingId(student.id);
        setError(null);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingStudent(null);
        setEditingId(null);
        setError(null);
    };

    // Update form field
    const updateField = (field: keyof AlumnoFormData, value: any) => {
        if (!editingStudent) return;
        setEditingStudent({ ...editingStudent, [field]: value });
    };

    // Toggle grupo in array
    const toggleGrupo = (grupo: string) => {
        if (!editingStudent) return;
        const currentGrupos = editingStudent.grupo || [];
        const newGrupos = currentGrupos.includes(grupo)
            ? currentGrupos.filter(g => g !== grupo)
            : [...currentGrupos, grupo];
        updateField('grupo', newGrupos);
    };

    // Helper: Format phone number for display (Venezuela format: 0XXX-XXX-XXXX)
    const formatPhoneNumber = (phone: string): string => {
        if (!phone) return '';
        // Remove all non-digit characters except leading +
        const cleaned = phone.replace(/[^\d+]/g, '');

        // Handle Venezuelan numbers (10-11 digits)
        if (cleaned.length === 11 && cleaned.startsWith('0')) {
            // Format: 0XXX-XXX-XXXX
            return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
        }
        if (cleaned.length === 10) {
            // Format: 0XXX-XXX-XXXX (add leading 0 if missing)
            return `0${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        if (cleaned.startsWith('+58') && cleaned.length >= 12) {
            // International format +58 XXX XXX XXXX
            const national = cleaned.slice(3);
            return `0${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
        }
        // Return as-is if format doesn't match
        return phone;
    };

    // Helper: Check if phone is valid (not empty, not placeholder)
    const isValidPhone = (phone: string | undefined): boolean => {
        return !!(phone && phone.trim() !== '' && phone !== 'Sin Completar');
    };

    // Helper: Get primary contact phone (prioritize representante principal, with fallback)
    // Priority: representante principal -> parent with complete info -> madre -> padre -> alumno
    const getPrimaryPhone = (student: Alumno): string => {
        // Safely get representante as string (may be object or other type in Firestore)
        const representanteRaw = student.representantes;
        const representante = typeof representanteRaw === 'string' ? representanteRaw.toLowerCase() : '';

        // Priority 1: If representante indicates madre
        if (representante.includes('madre')) {
            if (isValidPhone(student.tlf_madre)) return student.tlf_madre!;
            if (isValidPhone(student.tlf_padre)) return student.tlf_padre!;
            if (isValidPhone(student.tlf)) return student.tlf!;
            return '';
        }

        // Priority 2: If representante indicates padre
        if (representante.includes('padre')) {
            if (isValidPhone(student.tlf_padre)) return student.tlf_padre!;
            if (isValidPhone(student.tlf_madre)) return student.tlf_madre!;
            if (isValidPhone(student.tlf)) return student.tlf!;
            return '';
        }

        // Priority 3: Prefer parent with both name AND phone
        const hasMadreInfo = isValidPhone(student.tlf_madre) &&
            student.madre && student.madre !== 'Sin Completar' && student.madre !== 'Vacio';
        const hasPadreInfo = isValidPhone(student.tlf_padre) &&
            student.padre && student.padre !== 'Sin Completar' && student.padre !== 'Vacio';

        if (hasMadreInfo) return student.tlf_madre!;
        if (hasPadreInfo) return student.tlf_padre!;

        // Fallback: any available valid phone
        if (isValidPhone(student.tlf_madre)) return student.tlf_madre!;
        if (isValidPhone(student.tlf_padre)) return student.tlf_padre!;
        if (isValidPhone(student.tlf)) return student.tlf!;

        return '';
    };

    // Helper: Check if student has no contact info
    const hasNoContact = (student: Alumno): boolean => {
        return !getPrimaryPhone(student);
    };

    // Helper: Parse date string in multiple formats (DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY)
    const parseBirthDate = (dateStr: string): Date | null => {
        if (!dateStr) return null;

        // Try YYYY-MM-DD format first (ISO format)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) return date;
        }

        // Try DD/MM/YYYY format (common in Venezuela/Latin America)
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
            const parts = dateStr.split('/');
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // Month is 0-indexed
            const year = parseInt(parts[2]);
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) return date;
        }

        // Try DD-MM-YYYY format
        if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
            const parts = dateStr.split('-');
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const year = parseInt(parts[2]);
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) return date;
        }

        return null;
    };

    // Helper: Calculate age from birthdate
    const calculateAge = (birthDate: Date): number => {
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    // Helper: Get student age with source indicator
    // Returns: { age: number | null, source: 'calculated' | 'hardcoded' | 'none' }
    const getStudentAge = (student: Alumno): { age: number | null; source: 'calculated' | 'hardcoded' | 'none' } => {
        // Priority 1: Calculate from birthdate (nac field)
        if (student.nac) {
            const birthDate = parseBirthDate(student.nac);
            if (birthDate) {
                const calculatedAge = calculateAge(birthDate);
                if (calculatedAge >= 0 && calculatedAge < 120) {
                    return { age: calculatedAge, source: 'calculated' };
                }
            }
        }

        // Priority 2: Use hardcoded edad field
        if (student.edad !== undefined && student.edad !== null && student.edad !== '' && student.edad !== 0) {
            const numericAge = typeof student.edad === 'number'
                ? student.edad
                : parseInt(String(student.edad));
            if (!isNaN(numericAge) && numericAge > 0 && numericAge < 120) {
                return { age: numericAge, source: 'hardcoded' };
            }
        }

        return { age: null, source: 'none' };
    };

    // Helper: Check if today is student's birthday
    const isBirthdayToday = (student: Alumno): boolean => {
        if (!student.nac) return false;

        const birthDate = parseBirthDate(student.nac);
        if (!birthDate) return false;

        const today = new Date();
        return birthDate.getMonth() === today.getMonth() &&
            birthDate.getDate() === today.getDate();
    };

    // Helper: Detect if student has incomplete required data
    const hasIncompleteData = (student: Alumno): boolean => {
        // Required fields for a complete student profile
        const requiredFields = {
            nombre: student.nombre && student.nombre.trim() !== '',
            apellido: student.apellido && student.apellido.trim() !== '',
            instrumento: getInstrumentName(student.instrumento) !== 'Sin asignar',
            contacto: !!(student.tlf_madre || student.tlf_padre || student.tlf),
            representante: !!(student.nombre_padres || student.madre || student.padre),
        };

        // Check if any required field is missing
        return !Object.values(requiredFields).every(Boolean);
    };

    // Filter students
    const filteredStudents = students.filter(student => {
        const fullName = `${student.nombre} ${student.apellido}`.toLowerCase();
        const matchesSearch = fullName.includes(searchTerm.toLowerCase());
        const matchesInstrumento = !filterInstrumento || getInstrumentName(student.instrumento) === filterInstrumento;
        const matchesActivo = filterActivo === '' || String(student.activo) === filterActivo;
        // Auto-detect incomplete data instead of using manual field
        const isIncomplete = hasIncompleteData(student);
        const matchesPendientes = filterPendientes === '' || String(isIncomplete) === filterPendientes;
        return matchesSearch && matchesInstrumento && matchesActivo && matchesPendientes;
    });

    // Helper: Get primary contact name (aligned with getPrimaryPhone priority)
    const getPrimaryContactName = (student: Alumno): string => {
        // First check representante priority
        const representanteRaw = student.representantes;
        const representante = typeof representanteRaw === 'string' ? representanteRaw.toLowerCase() : '';

        if (representante.includes('madre') && student.madre &&
            student.madre !== 'Sin Completar' && student.madre !== 'Vacio') {
            return student.madre;
        }
        if (representante.includes('padre') && student.padre &&
            student.padre !== 'Sin Completar' && student.padre !== 'Vacio') {
            return student.padre;
        }

        // Then check nombre_padres field
        if (student.nombre_padres && student.nombre_padres !== 'Sin Completar') {
            return student.nombre_padres;
        }
        // Fallback to madre or padre
        if (student.madre && student.madre !== 'Sin Completar' && student.madre !== 'Vacio') {
            return student.madre;
        }
        if (student.padre && student.padre !== 'Sin Completar' && student.padre !== 'Vacio') {
            return student.padre;
        }
        return '';
    };

    // Toggle sort column/direction
    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            // If same column, toggle direction
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            // New column, start with ascending
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    // Sort students based on current sort state
    const sortedStudents = useMemo(() => {
        if (!sortColumn) return filteredStudents;

        return [...filteredStudents].sort((a, b) => {
            let comparison = 0;

            switch (sortColumn) {
                case 'nombre':
                    const nameA = `${a.apellido} ${a.nombre}`.toLowerCase();
                    const nameB = `${b.apellido} ${b.nombre}`.toLowerCase();
                    comparison = nameA.localeCompare(nameB, 'es');
                    break;
                case 'edad':
                    const ageInfoA = getStudentAge(a);
                    const ageInfoB = getStudentAge(b);
                    const edadA = ageInfoA.age || 0;
                    const edadB = ageInfoB.age || 0;
                    comparison = edadA - edadB;
                    break;
                case 'instrumento':
                    const instA = getInstrumentName(a.instrumento).toLowerCase();
                    const instB = getInstrumentName(b.instrumento).toLowerCase();
                    comparison = instA.localeCompare(instB, 'es');
                    break;
                case 'contacto':
                    // Has contact first (false = 0), no contact last (true = 1)
                    const noContactA = hasNoContact(a) ? 1 : 0;
                    const noContactB = hasNoContact(b) ? 1 : 0;
                    comparison = noContactA - noContactB;
                    break;
                case 'grupos':
                    const gruposA = a.grupo?.length || 0;
                    const gruposB = b.grupo?.length || 0;
                    comparison = gruposA - gruposB;
                    break;
                case 'estado':
                    // Active first (true = 0), inactive last (false = 1)
                    const activoA = a.activo ? 0 : 1;
                    const activoB = b.activo ? 0 : 1;
                    comparison = activoA - activoB;
                    break;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [filteredStudents, sortColumn, sortDirection]);

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
                        <ChevronUp className="w-3.5 h-3.5 text-blue-500" />
                    ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
                    )
                ) : (
                    <div className="w-3.5 h-3.5" /> // Placeholder for alignment
                )}
            </div>
        </th>
    );

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <GraduationCap className="w-7 h-7 text-blue-500" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                Alumnos
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {students.length} estudiantes registrados en Firestore
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadStudents}
                            disabled={loading}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="Recargar"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={openNewStudent}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo Alumno
                        </button>
                        {pageInfo.hasInfo && (
                            <InfoButton
                                title={pageInfo.title}
                                description={pageInfo.description}
                                tips={pageInfo.tips}
                            />
                        )}
                    </div>
                </div>

                {fromDiagnostics && (
                    <div className="mb-4 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 text-sm">
                        Contexto: abierto desde diagnostico de asistencias. Revisa y corrige este registro para habilitar notificaciones por WhatsApp.
                        {diagnosticReason && <span className="block mt-1 font-medium">Motivo: {diagnosticReason}</span>}
                        <button
                            onClick={() => {
                                const params = new URLSearchParams({
                                    source: 'fix-return',
                                    focus: 'contact-diagnostics'
                                });
                                if (diagnosticReason) params.set('reason', diagnosticReason);
                                if (diagnosticId) params.set('diagId', diagnosticId);
                                navigate(`/attendance?${params.toString()}`);
                            }}
                            className="mt-2 inline-flex items-center px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                        >
                            Volver a Diagnostico
                        </button>
                    </div>
                )}

                {/* Error Alert */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="sm:col-span-2 lg:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <select
                            value={filterInstrumento}
                            onChange={(e) => setFilterInstrumento(e.target.value)}
                            className="px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos los instrumentos ({uniqueInstruments.length})</option>
                            {uniqueInstruments.map(instrumento => (
                                <option key={instrumento} value={instrumento}>{instrumento}</option>
                            ))}
                        </select>
                        <select
                            value={filterActivo}
                            onChange={(e) => setFilterActivo(e.target.value as '' | 'true' | 'false')}
                            className="px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos los estados</option>
                            <option value="true">Activos</option>
                            <option value="false">Inactivos</option>
                        </select>
                        <select
                            value={filterPendientes}
                            onChange={(e) => setFilterPendientes(e.target.value as '' | 'true' | 'false')}
                            className="px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos los datos</option>
                            <option value="true">Datos Pendientes</option>
                            <option value="false">Datos Completos</option>
                        </select>
                    </div>
                </div>

                {/* Student List */}
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : filteredStudents.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-900/50">
                                    <tr>
                                        <SortableHeader column="nombre" label="Alumno" />
                                        <SortableHeader column="edad" label="Edad" className="hidden sm:table-cell" />
                                        <SortableHeader column="instrumento" label="Instrumento" />
                                        <SortableHeader column="contacto" label="Contacto" className="hidden md:table-cell" />
                                        <SortableHeader column="grupos" label="Grupos" className="hidden lg:table-cell" />
                                        <SortableHeader column="estado" label="Estado" />
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {sortedStudents.map(student => (
                                        <tr
                                            key={student.id}
                                            className={`
                                                hover:bg-gray-50 dark:hover:bg-gray-700/50 
                                                ${!student.activo ? 'opacity-60' : ''}
                                                ${isBirthdayToday(student) ? 'bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 border-l-4 border-l-pink-400' : ''}
                                            `}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {student.avatar ? (
                                                        <img
                                                            src={student.avatar}
                                                            alt={student.nombre}
                                                            className="w-10 h-10 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                                            <User className="w-5 h-5 text-blue-500" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        {editingCell?.studentId === student.id && editingCell?.field === 'nombre' ? (
                                                            <div className="flex gap-1">
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    defaultValue={getDisplayValue(student, 'nombre')}
                                                                    onBlur={(e) => {
                                                                        const val = e.target.value.trim();
                                                                        if (val && val !== student.nombre) setCellValue(student.id, 'nombre', val);
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            // Move focus to apellido input
                                                                            const next = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input:last-of-type');
                                                                            if (next && next !== e.target) next.focus();
                                                                            else (e.target as HTMLInputElement).blur();
                                                                        }
                                                                        if (e.key === 'Escape') stopEditing();
                                                                    }}
                                                                    className="w-1/2 px-2 py-0.5 text-sm border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                    placeholder="Nombre"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    defaultValue={pendingChanges[student.id]?.apellido !== undefined ? String(pendingChanges[student.id].apellido) : student.apellido}
                                                                    onBlur={(e) => {
                                                                        const val = e.target.value.trim();
                                                                        if (val && val !== student.apellido) setCellValue(student.id, 'apellido', val);
                                                                        stopEditing();
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                                        if (e.key === 'Escape') stopEditing();
                                                                    }}
                                                                    className="w-1/2 px-2 py-0.5 text-sm border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                    placeholder="Apellido"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className={`font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5 cursor-pointer rounded px-1 -mx-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${pendingChanges[student.id]?.nombre !== undefined || pendingChanges[student.id]?.apellido !== undefined ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-700' : ''}`}
                                                                onDoubleClick={() => startEditing(student.id, 'nombre')}
                                                                title="Doble click para editar nombre y apellido"
                                                            >
                                                                {getDisplayValue(student, 'nombre')} {pendingChanges[student.id]?.apellido !== undefined ? String(pendingChanges[student.id].apellido) : student.apellido}
                                                                {isBirthdayToday(student) && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400 text-xs font-medium animate-pulse">
                                                                        <Cake className="w-3.5 h-3.5" />
                                                                        ¡Cumple!
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className="text-xs text-gray-500">
                                                            {student.sexo === 'Masculino' ? '♂' : student.sexo === 'Femenino' ? '♀' : ''}
                                                            {student.email && <span className="ml-1">{student.email}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm hidden sm:table-cell">
                                                {editingCell?.studentId === student.id && editingCell?.field === 'nac' ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        defaultValue={pendingChanges[student.id]?.nac !== undefined ? String(pendingChanges[student.id].nac) : (student.nac || '')}
                                                        onBlur={(e) => {
                                                            const val = e.target.value.trim();
                                                            if (val !== (student.nac || '')) setCellValue(student.id, 'nac', val);
                                                            stopEditing();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                            if (e.key === 'Escape') stopEditing();
                                                        }}
                                                        className="w-28 px-2 py-0.5 text-xs border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        placeholder="DD/MM/AAAA"
                                                    />
                                                ) : (
                                                    <div
                                                        className={`cursor-pointer rounded px-1 -mx-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors inline-flex ${pendingChanges[student.id]?.nac !== undefined || pendingChanges[student.id]?.edad !== undefined ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-700' : ''}`}
                                                        onDoubleClick={() => startEditing(student.id, 'nac')}
                                                        title={`Doble click para editar fecha de nacimiento${student.nac ? ` (${student.nac})` : ''}`}
                                                    >
                                                        {(() => {
                                                            // Check pending nac change
                                                            const nacVal = pendingChanges[student.id]?.nac !== undefined ? String(pendingChanges[student.id].nac) : student.nac;
                                                            if (nacVal) {
                                                                const birthDate = parseBirthDate(nacVal);
                                                                if (birthDate) {
                                                                    const calcAge = calculateAge(birthDate);
                                                                    if (calcAge >= 0 && calcAge < 120) {
                                                                        return (
                                                                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                                                                                <Calendar className="w-3 h-3" />
                                                                                {calcAge} años
                                                                            </span>
                                                                        );
                                                                    }
                                                                }
                                                            }
                                                            const { age, source } = getStudentAge(student);
                                                            if (age === null) return <span className="text-gray-400">-</span>;
                                                            if (source === 'calculated') {
                                                                return (
                                                                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                                                                        <Calendar className="w-3 h-3" />
                                                                        {age} años
                                                                    </span>
                                                                );
                                                            }
                                                            return <span className="text-amber-600 dark:text-amber-400">{age} años*</span>;
                                                        })()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {editingCell?.studentId === student.id && editingCell?.field === 'instrumento' ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        defaultValue={getDisplayValue(student, 'instrumento')}
                                                        onBlur={(e) => {
                                                            const val = e.target.value.trim();
                                                            if (val !== getInstrumentName(student.instrumento)) setCellValue(student.id, 'instrumento', val);
                                                            stopEditing();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                            if (e.key === 'Escape') stopEditing();
                                                        }}
                                                        className="w-full px-2 py-0.5 text-xs border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        placeholder="Instrumento"
                                                    />
                                                ) : (
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${pendingChanges[student.id]?.instrumento !== undefined
                                                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 ring-1 ring-yellow-300 dark:ring-yellow-700'
                                                            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/40'
                                                        }`}
                                                        onDoubleClick={() => startEditing(student.id, 'instrumento')}
                                                        title="Doble click para editar instrumento"
                                                    >
                                                        {getDisplayValue(student, 'instrumento') || 'Sin asignar'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm hidden md:table-cell">
                                                {editingCell?.studentId === student.id && editingCell?.field === 'tlf_madre' ? (
                                                    <div className="space-y-1">
                                                        <input
                                                            autoFocus
                                                            type="tel"
                                                            defaultValue={getDisplayValue(student, 'tlf_madre')}
                                                            onBlur={(e) => {
                                                                const val = e.target.value.trim();
                                                                if (val !== (student.tlf_madre || '')) setCellValue(student.id, 'tlf_madre', val);
                                                                stopEditing();
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                                if (e.key === 'Escape') stopEditing();
                                                            }}
                                                            className="w-full px-2 py-0.5 text-xs border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            placeholder="Teléfono contacto"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={`cursor-pointer rounded px-1 -mx-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${pendingChanges[student.id]?.tlf_madre !== undefined || pendingChanges[student.id]?.tlf_padre !== undefined || pendingChanges[student.id]?.madre !== undefined || pendingChanges[student.id]?.padre !== undefined
                                                            ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-700' : ''}`}
                                                        onDoubleClick={() => startEditing(student.id, 'tlf_madre')}
                                                        title="Doble click para editar contacto"
                                                    >
                                                        {getPrimaryPhone(student) ? (
                                                            <>
                                                                <div className="text-gray-800 dark:text-gray-200 text-xs">
                                                                    {getPrimaryContactName(student)}
                                                                </div>
                                                                <div className="text-blue-500 text-xs flex items-center gap-1">
                                                                    <Phone className="w-3 h-3" />
                                                                    {formatPhoneNumber(getPrimaryPhone(student))}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium">
                                                                <PhoneOff className="w-3 h-3" />
                                                                Sin contacto
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                                                {editingCell?.studentId === student.id && editingCell?.field === 'grupo' ? (
                                                    <div className="relative">
                                                        <div className="flex flex-wrap gap-1 p-2 border border-blue-400 rounded bg-white dark:bg-gray-700 max-w-xs">
                                                            {GRUPOS_DISPONIBLES.map(g => {
                                                                const currentGrupos: string[] = pendingChanges[student.id]?.grupo !== undefined
                                                                    ? (pendingChanges[student.id].grupo as string[])
                                                                    : (student.grupo || []);
                                                                const isSelected = currentGrupos.includes(g);
                                                                return (
                                                                    <button
                                                                        key={g}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newGrupos = isSelected
                                                                                ? currentGrupos.filter(x => x !== g)
                                                                                : [...currentGrupos, g];
                                                                            setCellValue(student.id, 'grupo', newGrupos);
                                                                        }}
                                                                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${isSelected
                                                                            ? 'bg-blue-500 text-white'
                                                                            : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                                                                        }`}
                                                                    >
                                                                        {g}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        <button
                                                            onClick={stopEditing}
                                                            className="mt-1 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                                        >
                                                            Cerrar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={`cursor-pointer rounded px-1 -mx-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${pendingChanges[student.id]?.grupo !== undefined ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-700' : ''}`}
                                                        onDoubleClick={() => startEditing(student.id, 'grupo')}
                                                        title="Doble click para editar grupos"
                                                    >
                                                        {(() => {
                                                            const grupos: string[] = pendingChanges[student.id]?.grupo !== undefined
                                                                ? (pendingChanges[student.id].grupo as string[])
                                                                : (student.grupo || []);
                                                            if (grupos.length > 0) {
                                                                return (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {grupos.slice(0, 2).map((g, i) => (
                                                                            <span key={i} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                                                                                {g}
                                                                            </span>
                                                                        ))}
                                                                        {grupos.length > 2 && (
                                                                            <span className="text-xs text-gray-500">+{grupos.length - 2}</span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            }
                                                            return <span className="text-gray-400 italic">Sin grupos</span>;
                                                        })()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {(() => {
                                                        const isActivo = pendingChanges[student.id]?.activo !== undefined
                                                            ? pendingChanges[student.id].activo
                                                            : student.activo;
                                                        const hasChange = pendingChanges[student.id]?.activo !== undefined;
                                                        return (
                                                            <span
                                                                className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${isActivo
                                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/40'
                                                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                                } ${hasChange ? 'ring-1 ring-yellow-300 dark:ring-yellow-700' : ''}`}
                                                                onDoubleClick={() => {
                                                                    setCellValue(student.id, 'activo', !isActivo);
                                                                }}
                                                                title="Doble click para cambiar estado"
                                                            >
                                                                {isActivo ? 'Activo' : 'Inactivo'}
                                                            </span>
                                                        );
                                                    })()}
                                                    {hasIncompleteData(student) && (
                                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                                            Pendiente
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openEditStudent(student)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-blue-500"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDeleteId(student.id)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-red-500"
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
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-8 text-center">
                        <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">
                            No hay alumnos
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            {searchTerm || filterInstrumento || filterActivo
                                ? 'No se encontraron alumnos con los filtros aplicados'
                                : 'Comienza registrando tu primer alumno'}
                        </p>
                        <button
                            onClick={openNewStudent}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                        >
                            Registrar Alumno
                        </button>
                    </div>
                )}

                {/* Modal */}
                {showModal && editingStudent && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                                    {editingId ? 'Editar Alumno' : 'Nuevo Alumno'}
                                </h3>
                                <button
                                    onClick={closeModal}
                                    className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-4 space-y-6">
                                {/* Error in modal */}
                                {error && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
                                        <AlertCircle className="w-4 h-4" />
                                        {error}
                                    </div>
                                )}

                                {/* ==================== DATOS PERSONALES ==================== */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Datos Personales
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Nombre *
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.nombre}
                                                onChange={(e) => updateField('nombre', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Nombre"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Apellido
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.apellido}
                                                onChange={(e) => updateField('apellido', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Apellido"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 mt-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                <Calendar className="w-3 h-3 inline mr-1" />
                                                Fecha Nacimiento
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.nac}
                                                onChange={(e) => updateField('nac', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="DD/MM/AAAA"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Edad
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.edad}
                                                onChange={(e) => updateField('edad', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Edad"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Sexo
                                            </label>
                                            <select
                                                value={editingStudent.sexo}
                                                onChange={(e) => updateField('sexo', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">Seleccionar...</option>
                                                <option value="Masculino">Masculino</option>
                                                <option value="Femenino">Femenino</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Cédula
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.cedula}
                                                onChange={(e) => updateField('cedula', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Cédula del alumno"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Religión
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.religion}
                                                onChange={(e) => updateField('religion', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Religión (opcional)"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ==================== CONTACTO ==================== */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                        <Phone className="w-4 h-4" />
                                        Contacto
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Teléfono Principal
                                            </label>
                                            <input
                                                type="tel"
                                                value={editingStudent.tlf}
                                                onChange={(e) => updateField('tlf', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="829 123 4567"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                <Mail className="w-3 h-3 inline mr-1" />
                                                Email
                                            </label>
                                            <input
                                                type="email"
                                                value={editingStudent.email}
                                                onChange={(e) => updateField('email', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="email@ejemplo.com"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                <MapPin className="w-3 h-3 inline mr-1" />
                                                Dirección
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.direccion}
                                                onChange={(e) => updateField('direccion', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Dirección"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                <Heart className="w-3 h-3 inline mr-1" />
                                                Teléfono Emergencia
                                            </label>
                                            <input
                                                type="tel"
                                                value={editingStudent.emergencia}
                                                onChange={(e) => updateField('emergencia', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Teléfono de emergencia"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ==================== PADRES / REPRESENTANTES ==================== */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        Padres / Representantes
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Nombre del Padre
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.padre}
                                                onChange={(e) => updateField('padre', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Nombre completo del padre"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Teléfono Padre
                                            </label>
                                            <input
                                                type="tel"
                                                value={editingStudent.tlf_padre}
                                                onChange={(e) => updateField('tlf_padre', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Teléfono del padre"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Cédula Padre
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.cedula_padre}
                                                onChange={(e) => updateField('cedula_padre', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Cédula del padre"
                                            />
                                        </div>
                                        <div></div>
                                    </div>

                                    <div className="border-t dark:border-gray-700 my-3 pt-3"></div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Nombre de la Madre
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.madre}
                                                onChange={(e) => updateField('madre', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Nombre completo de la madre"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Teléfono Madre
                                            </label>
                                            <input
                                                type="tel"
                                                value={editingStudent.tlf_madre}
                                                onChange={(e) => updateField('tlf_madre', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Teléfono de la madre"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Cédula Madre
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.cedula_madre}
                                                onChange={(e) => updateField('cedula_madre', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Cédula de la madre"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Representante Principal
                                            </label>
                                            <select
                                                value={editingStudent.representantes}
                                                onChange={(e) => updateField('representantes', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">Seleccionar...</option>
                                                <option value="Padre">Padre</option>
                                                <option value="Madre">Madre</option>
                                                <option value="Ambos">Ambos</option>
                                                <option value="Tutor">Tutor Legal</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Nombre del Representante
                                        </label>
                                        <input
                                            type="text"
                                            value={editingStudent.nombre_padres}
                                            onChange={(e) => updateField('nombre_padres', e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Nombre del representante principal"
                                        />
                                    </div>
                                </div>

                                {/* ==================== ESCUELA / TRABAJO ==================== */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                        <School className="w-4 h-4" />
                                        Colegio / Trabajo
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Colegio / Trabajo
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.colegio_trabajo}
                                                onChange={(e) => updateField('colegio_trabajo', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Nombre del colegio o trabajo"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Horario Disponible
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.horario_colegio_trabajo}
                                                onChange={(e) => updateField('horario_colegio_trabajo', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Ej: Tardes durante la semana"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Medios de Transporte
                                        </label>
                                        <input
                                            type="text"
                                            value={editingStudent.medios_transporte}
                                            onChange={(e) => updateField('medios_transporte', e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="¿Cómo llega a las clases?"
                                        />
                                    </div>
                                </div>

                                {/* ==================== INFORMACIÓN ACADÉMICA ==================== */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                        <Music className="w-4 h-4" />
                                        Información Académica
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Instrumento
                                            </label>
                                            <input
                                                type="text"
                                                value={editingStudent.instrumento}
                                                onChange={(e) => updateField('instrumento', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Ej: Violín, Piano, Flauta..."
                                            />
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editingStudent.activo}
                                                    onChange={(e) => updateField('activo', e.target.checked)}
                                                    className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500"
                                                />
                                                <span className={`text-sm font-medium ${editingStudent.activo ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                    {editingStudent.activo ? 'Alumno Activo' : 'Alumno Inactivo'}
                                                </span>
                                            </label>

                                            {/* Auto-detection of missing data indicator */}
                                            {(() => {
                                                const missing: string[] = [];
                                                if (!editingStudent.nombre.trim()) missing.push('Nombre');
                                                if (!editingStudent.apellido.trim()) missing.push('Apellido');
                                                if (!editingStudent.instrumento.trim()) missing.push('Instrumento');
                                                if (!editingStudent.tlf && !editingStudent.tlf_madre && !editingStudent.tlf_padre) missing.push('Contacto');
                                                if (!editingStudent.nombre_padres && !editingStudent.madre && !editingStudent.padre) missing.push('Representante');

                                                if (missing.length > 0) {
                                                    return (
                                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg text-xs">
                                                            <AlertCircle className="w-4 h-4" />
                                                            <span>Falta: {missing.join(', ')}</span>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-xs">
                                                        <span>✓ Datos completos</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Grupos Multi-select */}
                                    <div className="mt-4">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Grupos / Clases
                                        </label>
                                        <div className="flex flex-wrap gap-2 p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                                            {GRUPOS_DISPONIBLES.map(grupo => (
                                                <button
                                                    key={grupo}
                                                    type="button"
                                                    onClick={() => toggleGrupo(grupo)}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${editingStudent.grupo.includes(grupo)
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                                        }`}
                                                >
                                                    {grupo}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {editingStudent.grupo.length} grupo(s) seleccionado(s)
                                        </p>
                                    </div>
                                </div>

                                {/* ==================== OBSERVACIONES ==================== */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        Observaciones
                                    </h4>
                                    <textarea
                                        value={editingStudent.observaciones}
                                        onChange={(e) => updateField('observaciones', e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                        placeholder="Notas adicionales sobre el alumno..."
                                    />
                                </div>

                                {/* ==================== URL AVATAR ==================== */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        URL de Avatar (opcional)
                                    </label>
                                    <input
                                        type="url"
                                        value={editingStudent.avatar}
                                        onChange={(e) => updateField('avatar', e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 p-4 border-t dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
                                <button
                                    onClick={closeModal}
                                    className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !editingStudent.nombre || !editingStudent.apellido}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Floating Save Bar for Inline Edits */}
                {hasPendingChanges && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center gap-3 px-5 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl shadow-2xl border border-gray-700 dark:border-gray-300">
                            <div className="flex items-center gap-2 text-sm">
                                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                                <span className="font-medium">
                                    {pendingCount} alumno{pendingCount > 1 ? 's' : ''} modificado{pendingCount > 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="w-px h-6 bg-gray-600 dark:bg-gray-400" />
                            <button
                                onClick={discardChanges}
                                disabled={savingInline}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 dark:text-gray-600 hover:text-white dark:hover:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                <Undo2 className="w-4 h-4" />
                                Descartar
                            </button>
                            <button
                                onClick={saveAllChanges}
                                disabled={savingInline}
                                className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                            >
                                {savingInline ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4" />
                                )}
                                {savingInline ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Confirm Delete Modal */}
                {confirmDeleteId && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border dark:border-gray-700 animate-in zoom-in-95 duration-200">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 mx-auto">
                                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold text-center text-gray-800 dark:text-white mb-2">
                                ¿Eliminar Alumno?
                            </h3>
                            <p className="text-center text-gray-500 dark:text-gray-400 mb-6">
                                Esta acción eliminará el alumno de forma <strong>definitiva</strong> en Firestore. No se puede deshacer.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    disabled={deleting}
                                    className="flex-1 px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleDelete(confirmDeleteId)}
                                    disabled={deleting}
                                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {deleting ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
