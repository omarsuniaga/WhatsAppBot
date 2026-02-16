/**
 * TeachersPage - Manage teachers/instructors
 * Connected directly to Firestore MAESTROS collection
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Users, Plus, Edit2, Trash2, RefreshCw,
    Phone, Mail, Search, AlertCircle, User, X, Save,
    ChevronUp, ChevronDown, PhoneOff, GitMerge, Check, Undo2
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { maestrosService, Maestro } from '../services/firestore';
import { LinkClassesModal } from '../components/teachers/LinkClassesModal';
import { MergeTeachersModal } from '../components/teachers/MergeTeachersModal';
import { InfoButton } from '../components/common/InfoButton';
import { usePageInfo } from '../hooks/useViewInfo';

// Sort column type
type SortColumn = 'name' | 'phone' | 'instruments' | 'status' | null;
type SortDirection = 'asc' | 'desc';

// Inline editing types
type EditableField = 'name' | 'primaryInstrument' | 'phone' | 'email' | 'status';
type EditingCell = { teacherId: string; field: EditableField } | null;
type PendingChanges = Record<string, Partial<Maestro>>;

export const TeachersPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [teachers, setTeachers] = useState<Maestro[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pageInfo = usePageInfo('teachers');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'' | 'active' | 'inactive'>('');
    const [editingTeacher, setEditingTeacher] = useState<Partial<Maestro> | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [linkingTeacher, setLinkingTeacher] = useState<Maestro | null>(null);
    const [mergingTeacher, setMergingTeacher] = useState<Maestro | null>(null);

    // Sorting state
    const [sortColumn, setSortColumn] = useState<SortColumn>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    // Modal state
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Inline editing state
    const [editingCell, setEditingCell] = useState<EditingCell>(null);
    const [pendingChanges, setPendingChanges] = useState<PendingChanges>({});
    const [savingInline, setSavingInline] = useState(false);
    const fromDiagnostics = searchParams.get('source') === 'attendance-diagnostics';
    const diagnosticReason = searchParams.get('reason') || '';
    const diagnosticId = searchParams.get('diagId') || '';

    const hasPendingChanges = Object.keys(pendingChanges).length > 0;
    const pendingCount = Object.keys(pendingChanges).length;

    // Load teachers from Firestore
    const loadTeachers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await maestrosService.getAllMaestros();
            setTeachers(data);
        } catch (err: any) {
            console.error('Error loading teachers:', err);
            setError('Error al cargar los maestros. Verifica la conexión con Firebase.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTeachers();
    }, [loadTeachers]);

    useEffect(() => {
        const urlSearch = searchParams.get('search');
        if (urlSearch && urlSearch !== searchTerm) {
            setSearchTerm(urlSearch);
        }

        const editTeacherId = searchParams.get('edit');
        if (editTeacherId && teachers.length > 0 && !showModal) {
            const teacher = teachers.find(t => t.id === editTeacherId || t.uid === editTeacherId);
            if (teacher) {
                setEditingTeacher({ ...teacher });
                setEditingId(teacher.id);
                setError(null);
                setShowModal(true);
            }

            setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.delete('edit');
                return next;
            });
        }
    }, [searchParams, setSearchParams, teachers, showModal, searchTerm]);

    // Helper: Format phone number (Venezuela format: 0XXX-XXX-XXXX)
    const formatPhoneNumber = (phone: string): string => {
        if (!phone) return '';
        const cleaned = phone.replace(/[^\d+]/g, '');

        if (cleaned.length === 11 && cleaned.startsWith('0')) {
            return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
        }
        if (cleaned.length === 10) {
            return `0${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        if (cleaned.startsWith('+58') && cleaned.length >= 12) {
            const national = cleaned.slice(3);
            return `0${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
        }
        return phone;
    };

    // Helper: Check if teacher has no contact
    const hasNoContact = (teacher: Maestro): boolean => {
        return !teacher.phone && !teacher.email;
    };

    // Helper: Get primary instrument(s) display
    const getInstrumentsDisplay = (teacher: Maestro): string => {
        // Priority 1: Check simple primaryInstrument field
        if (teacher.primaryInstrument && teacher.primaryInstrument.trim()) {
            return teacher.primaryInstrument;
        }
        // Priority 2: Check instruments array
        if (teacher.instruments && teacher.instruments.length > 0) {
            const validInstruments = teacher.instruments
                .map(i => i.instrument)
                .filter(inst => inst && inst.trim() && !inst.includes('-1'));
            if (validInstruments.length > 0) {
                return validInstruments.join(', ');
            }
        }
        // Priority 3: Check specialties
        if (teacher.specialties && teacher.specialties.length > 0) {
            const validSpecialties = teacher.specialties.filter(s => s && s.trim());
            if (validSpecialties.length > 0) {
                return validSpecialties.join(', ');
            }
        }
        return 'Sin asignar';
    };

    // Filter teachers
    const filteredTeachers = teachers.filter(t => {
        const matchesSearch = !searchTerm ||
            t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            getInstrumentsDisplay(t).toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = !filterStatus || t.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    // Toggle sort column/direction
    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    // Sort teachers
    const sortedTeachers = useMemo(() => {
        if (!sortColumn) return filteredTeachers;

        return [...filteredTeachers].sort((a, b) => {
            let comparison = 0;

            switch (sortColumn) {
                case 'name':
                    comparison = (a.name || '').localeCompare(b.name || '', 'es');
                    break;
                case 'phone':
                    // Has phone first
                    const noPhoneA = !a.phone ? 1 : 0;
                    const noPhoneB = !b.phone ? 1 : 0;
                    comparison = noPhoneA - noPhoneB;
                    break;
                case 'instruments':
                    comparison = getInstrumentsDisplay(a).localeCompare(getInstrumentsDisplay(b), 'es');
                    break;
                case 'status':
                    // Active first
                    const statusA = a.status === 'active' ? 0 : 1;
                    const statusB = b.status === 'active' ? 0 : 1;
                    comparison = statusA - statusB;
                    break;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [filteredTeachers, sortColumn, sortDirection]);

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
                        <ChevronUp className="w-3.5 h-3.5 text-teal-500" />
                    ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-teal-500" />
                    )
                ) : (
                    <div className="w-3.5 h-3.5" />
                )}
            </div>
        </th>
    );

    // Inline editing helpers
    const getDisplayValue = (teacher: Maestro, field: EditableField): string => {
        const changes = pendingChanges[teacher.id];
        if (changes && field in changes) {
            const val = changes[field];
            return String(val ?? '');
        }
        const val = teacher[field];
        if (val === undefined || val === null) return '';
        return String(val);
    };

    const setCellValue = (teacherId: string, field: EditableField, value: any) => {
        setPendingChanges(prev => {
            const existing = prev[teacherId] || {};
            return { ...prev, [teacherId]: { ...existing, [field]: value } };
        });
    };

    const startEditing = (teacherId: string, field: EditableField) => {
        setEditingCell({ teacherId, field });
    };

    const stopEditing = () => {
        setEditingCell(null);
    };

    const discardChanges = () => {
        setPendingChanges({});
        setEditingCell(null);
    };

    const saveAllChanges = async () => {
        if (!hasPendingChanges) return;
        setSavingInline(true);
        setError(null);
        try {
            const promises = Object.entries(pendingChanges).map(([teacherId, changes]) =>
                maestrosService.update(teacherId, changes)
            );
            await Promise.all(promises);
            setPendingChanges({});
            setEditingCell(null);
            await loadTeachers();
        } catch (err: any) {
            console.error('Error saving inline changes:', err);
            setError(err.message || 'Error al guardar los cambios');
        } finally {
            setSavingInline(false);
        }
    };

    // Save teacher
    const handleSave = async () => {
        if (!editingTeacher) return;

        if (!editingTeacher.name?.trim()) {
            setError('El nombre es requerido');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            if (editingId) {
                await maestrosService.update(editingId, editingTeacher);
            } else {
                await maestrosService.create(editingTeacher as Omit<Maestro, 'id'>);
            }
            await loadTeachers();
            closeModal();
        } catch (err: any) {
            console.error('Error saving teacher:', err);
            setError(err.message || 'Error al guardar el maestro');
        } finally {
            setSaving(false);
        }
    };

    // Delete teacher
    const handleDelete = async (id: string) => {
        setDeleting(true);
        try {
            await maestrosService.delete(id);
            await loadTeachers();
            setConfirmDeleteId(null);
        } catch (err: any) {
            console.error('Error deleting teacher:', err);
            setError(err.message || 'Error al eliminar el maestro');
        } finally {
            setDeleting(false);
        }
    };

    const openNewTeacher = () => {
        setEditingTeacher({
            name: '',
            phone: '',
            email: '',
            primaryInstrument: '',
            address: '',
            biography: '',
            specialties: [],
            status: 'active'
        });
        setEditingId(null);
        setError(null);
        setShowModal(true);
    };

    const openEditTeacher = (teacher: Maestro) => {
        setEditingTeacher({ ...teacher });
        setEditingId(teacher.id);
        setError(null);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingTeacher(null);
        setEditingId(null);
        setError(null);
    };

    const updateField = (field: keyof Maestro, value: any) => {
        if (editingTeacher) {
            setEditingTeacher({ ...editingTeacher, [field]: value });
        }
    };

    const handleLinkSuccess = async () => {
        setLinkingTeacher(null);
        await loadTeachers();
    };

    const handleMergeSuccess = async () => {
        setMergingTeacher(null);
        await loadTeachers();
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <Users className="w-7 h-7 text-teal-500" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                Maestros
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {teachers.length} maestros registrados en Firestore
                            </p>
                        </div>
                        {pageInfo.hasInfo && (
                            <InfoButton
                                title={pageInfo.title}
                                description={pageInfo.description}
                                tips={pageInfo.tips}
                            />
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadTeachers}
                            disabled={loading}
                            className="p-2 text-gray-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"
                            title="Recargar"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={openNewTeacher}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo Maestro
                        </button>
                    </div>
                </div>

                {fromDiagnostics && (
                    <div className="mb-4 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 text-sm">
                        Contexto: abierto desde diagnostico de asistencias. Actualiza este maestro para resolver contacto/JID de WhatsApp.
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, email, instrumento..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as '' | 'active' | 'inactive')}
                            className="px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="">Todos los estados</option>
                            <option value="active">Activos</option>
                            <option value="inactive">Inactivos</option>
                        </select>
                    </div>
                </div>

                {/* Teachers Table */}
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <RefreshCw className="w-8 h-8 animate-spin text-teal-500" />
                    </div>
                ) : sortedTeachers.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-900/50">
                                    <tr>
                                        <SortableHeader column="name" label="Maestro" />
                                        <SortableHeader column="instruments" label="Instrumentos" className="hidden md:table-cell" />
                                        <SortableHeader column="phone" label="Contacto" className="hidden sm:table-cell" />
                                        <SortableHeader column="status" label="Estado" />
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {sortedTeachers.map(teacher => (
                                        <tr
                                            key={teacher.id}
                                            className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${teacher.status !== 'active' ? 'opacity-60' : ''}`}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {teacher.photoURL ? (
                                                        <img
                                                            src={teacher.photoURL}
                                                            alt={teacher.name}
                                                            className="w-10 h-10 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                                                            <User className="w-5 h-5 text-teal-500" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        {editingCell?.teacherId === teacher.id && editingCell?.field === 'name' ? (
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                defaultValue={getDisplayValue(teacher, 'name')}
                                                                onBlur={(e) => {
                                                                    const val = e.target.value.trim();
                                                                    if (val && val !== teacher.name) setCellValue(teacher.id, 'name', val);
                                                                    stopEditing();
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                                    if (e.key === 'Escape') stopEditing();
                                                                }}
                                                                className="w-full px-2 py-0.5 text-sm border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        ) : (
                                                            <div
                                                                className={`font-medium text-gray-800 dark:text-gray-200 cursor-pointer rounded px-1 -mx-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${pendingChanges[teacher.id]?.name !== undefined ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-700' : ''}`}
                                                                onDoubleClick={() => startEditing(teacher.id, 'name')}
                                                                title="Doble click para editar"
                                                            >
                                                                {getDisplayValue(teacher, 'name')}
                                                            </div>
                                                        )}
                                                        {editingCell?.teacherId === teacher.id && editingCell?.field === 'email' ? (
                                                            <input
                                                                type="email"
                                                                defaultValue={getDisplayValue(teacher, 'email')}
                                                                onBlur={(e) => {
                                                                    const val = e.target.value.trim();
                                                                    if (val && val !== teacher.email) setCellValue(teacher.id, 'email', val);
                                                                    stopEditing();
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                                    if (e.key === 'Escape') stopEditing();
                                                                }}
                                                                className="w-full px-2 py-0.5 text-xs border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        ) : (
                                                            teacher.email && (
                                                                <div
                                                                    className={`text-xs text-gray-500 flex items-center gap-1 cursor-pointer rounded px-1 -mx-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${pendingChanges[teacher.id]?.email !== undefined ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-700 text-yellow-700 dark:text-yellow-300' : ''}`}
                                                                    onDoubleClick={() => startEditing(teacher.id, 'email')}
                                                                    title="Doble click para editar"
                                                                >
                                                                    <Mail className="w-3 h-3" />
                                                                    {getDisplayValue(teacher, 'email')}
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                {editingCell?.teacherId === teacher.id && editingCell?.field === 'primaryInstrument' ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        defaultValue={getDisplayValue(teacher, 'primaryInstrument')}
                                                        onBlur={(e) => {
                                                            const val = e.target.value.trim();
                                                            if (val && val !== teacher.primaryInstrument) setCellValue(teacher.id, 'primaryInstrument', val);
                                                            stopEditing();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                            if (e.key === 'Escape') stopEditing();
                                                        }}
                                                        className="px-2 py-0.5 text-xs border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                ) : (
                                                    <div
                                                        className={`flex flex-wrap gap-1 cursor-pointer rounded px-1 -mx-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${pendingChanges[teacher.id]?.primaryInstrument !== undefined ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-700' : ''}`}
                                                        onDoubleClick={() => startEditing(teacher.id, 'primaryInstrument')}
                                                        title="Doble click para editar"
                                                    >
                                                        {teacher.primaryInstrument ? (
                                                            <span className="px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-medium">
                                                                {getDisplayValue(teacher, 'primaryInstrument')}
                                                            </span>
                                                        ) : (teacher.instruments && teacher.instruments.length > 0) ? (
                                                            teacher.instruments
                                                                .filter(inst => inst.instrument && inst.instrument.trim() && !inst.instrument.includes('-1'))
                                                                .slice(0, 2)
                                                                .map((inst, i) => (
                                                                    <span key={i} className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium">
                                                                        {inst.instrument}
                                                                    </span>
                                                                ))
                                                        ) : teacher.specialties && teacher.specialties.length > 0 ? (
                                                            teacher.specialties
                                                                .filter(spec => spec && spec.trim())
                                                                .slice(0, 2)
                                                                .map((spec, i) => (
                                                                    <span key={i} className="px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-medium">
                                                                        {spec}
                                                                    </span>
                                                                ))
                                                        ) : (
                                                            <span className="text-gray-400 italic text-xs">Sin asignar</span>
                                                        )}
                                                        {!teacher.primaryInstrument && ((teacher.instruments?.filter(i => i.instrument && !i.instrument.includes('-1')).length || 0) + (teacher.specialties?.length || 0) > 2) && (
                                                            <span className="text-xs text-gray-500">
                                                                +{(teacher.instruments?.filter(i => i.instrument && !i.instrument.includes('-1')).length || 0) + (teacher.specialties?.length || 0) - 2}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm hidden sm:table-cell">
                                                {editingCell?.teacherId === teacher.id && editingCell?.field === 'phone' ? (
                                                    <input
                                                        autoFocus
                                                        type="tel"
                                                        defaultValue={getDisplayValue(teacher, 'phone')}
                                                        onBlur={(e) => {
                                                            const val = e.target.value.trim();
                                                            if (val && val !== teacher.phone) setCellValue(teacher.id, 'phone', val);
                                                            stopEditing();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                            if (e.key === 'Escape') stopEditing();
                                                        }}
                                                        className="px-2 py-0.5 text-xs border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        placeholder="04XX-XXX-XXXX"
                                                    />
                                                ) : teacher.phone ? (
                                                    <a
                                                        href={`tel:${teacher.phone}`}
                                                        className={`text-teal-500 hover:underline text-xs flex items-center gap-1 cursor-pointer rounded px-1 -mx-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${pendingChanges[teacher.id]?.phone !== undefined ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-700 text-teal-700 dark:text-teal-300' : ''}`}
                                                        onDoubleClick={(e) => {
                                                            e.preventDefault();
                                                            startEditing(teacher.id, 'phone');
                                                        }}
                                                        title="Doble click para editar"
                                                    >
                                                        <Phone className="w-3 h-3" />
                                                        {formatPhoneNumber(getDisplayValue(teacher, 'phone'))}
                                                    </a>
                                                ) : hasNoContact(teacher) ? (
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${pendingChanges[teacher.id]?.phone !== undefined ? 'bg-yellow-100 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-700 text-yellow-700 dark:text-yellow-300' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}
                                                        onDoubleClick={() => startEditing(teacher.id, 'phone')}
                                                        title="Doble click para agregar"
                                                    >
                                                        <PhoneOff className="w-3 h-3" />
                                                        Sin contacto
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">Solo email</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                                                        pendingChanges[teacher.id]?.status !== undefined
                                                            ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-700 text-yellow-700 dark:text-yellow-300'
                                                            : teacher.status === 'active'
                                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                                    }`}
                                                    onDoubleClick={() => {
                                                        const newStatus = (pendingChanges[teacher.id]?.status || teacher.status) === 'active' ? 'inactive' : 'active';
                                                        setCellValue(teacher.id, 'status', newStatus);
                                                    }}
                                                    title="Doble click para alternar"
                                                >
                                                    {String(pendingChanges[teacher.id]?.status || teacher.status) === 'active' ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => setMergingTeacher(teacher)}
                                                        className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded transition-colors"
                                                        title="Fusionar con Duplicado"
                                                    >
                                                        <GitMerge className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setLinkingTeacher(teacher)}
                                                        className="p-1.5 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded transition-colors"
                                                        title="Vincular Clases"
                                                    >
                                                        <Users className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => openEditTeacher(teacher)}
                                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4 text-blue-500" />
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDeleteId(teacher.id)}
                                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-500" />
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
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No se encontraron maestros</p>
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="mt-2 text-teal-500 hover:underline"
                            >
                                Limpiar búsqueda
                            </button>
                        )}
                    </div>
                )}

                {/* Edit Modal */}
                {showModal && editingTeacher && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                                    {editingId ? 'Editar Maestro' : 'Nuevo Maestro'}
                                </h2>
                                <button onClick={closeModal}>
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
                                        value={editingTeacher.name || ''}
                                        onChange={(e) => updateField('name', e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                        placeholder="Nombre completo"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Teléfono
                                    </label>
                                    <input
                                        type="tel"
                                        value={editingTeacher.phone || ''}
                                        onChange={(e) => updateField('phone', e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                        placeholder="04XX-XXX-XXXX"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={editingTeacher.email || ''}
                                        onChange={(e) => updateField('email', e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                        placeholder="email@ejemplo.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Instrumento Principal
                                    </label>
                                    <input
                                        type="text"
                                        value={editingTeacher.primaryInstrument || ''}
                                        onChange={(e) => updateField('primaryInstrument', e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                        placeholder="Ej: Piano, Violín, Flauta..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Dirección
                                    </label>
                                    <input
                                        type="text"
                                        value={editingTeacher.address || ''}
                                        onChange={(e) => updateField('address', e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                        placeholder="Dirección"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Biografía
                                    </label>
                                    <textarea
                                        value={editingTeacher.biography || ''}
                                        onChange={(e) => updateField('biography', e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                        rows={3}
                                        placeholder="Breve descripción del maestro..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Estado
                                    </label>
                                    <select
                                        value={editingTeacher.status || 'active'}
                                        onChange={(e) => updateField('status', e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                    >
                                        <option value="active">Activo</option>
                                        <option value="inactive">Inactivo</option>
                                        <option value="pending">Pendiente</option>
                                    </select>
                                </div>
                            </div>
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
                                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg disabled:opacity-50"
                                >
                                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Guardar
                                </button>
                            </div>
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
                                ¿Eliminar Maestro?
                            </h3>
                            <p className="text-center text-gray-500 dark:text-gray-400 mb-6">
                                Esta acción eliminará el registro de forma <strong>definitiva</strong> en Firestore. No se puede deshacer.
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

                {/* Floating Save Bar for Inline Edits */}
                {hasPendingChanges && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center gap-3 px-5 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl shadow-2xl border border-gray-700 dark:border-gray-300">
                            <div className="flex items-center gap-2 text-sm">
                                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                                <span className="font-medium">
                                    {pendingCount} maestro{pendingCount > 1 ? 's' : ''} modificado{pendingCount > 1 ? 's' : ''}
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

                {/* Link Classes Modal */}
                {linkingTeacher && (
                    <LinkClassesModal
                        teacher={linkingTeacher}
                        onClose={() => setLinkingTeacher(null)}
                        onSuccess={handleLinkSuccess}
                    />
                )}

                {mergingTeacher && (
                    <MergeTeachersModal
                        targetTeacher={mergingTeacher}
                        onClose={() => setMergingTeacher(null)}
                        onSuccess={handleMergeSuccess}
                    />
                )}

            </div>
        </div>
    );
};
