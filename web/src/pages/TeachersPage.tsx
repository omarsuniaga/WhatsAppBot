/**
 * TeachersPage - Manage teachers/instructors
 * Connected directly to Firestore MAESTROS collection
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Users, Plus, Edit2, Trash2, RefreshCw,
    Phone, Mail, Search, AlertCircle, User, X, Save,
    ChevronUp, ChevronDown, PhoneOff, GitMerge
} from 'lucide-react';
import { maestrosService, Maestro } from '../services/firestore';
import { LinkClassesModal } from '../components/teachers/LinkClassesModal';
import { MergeTeachersModal } from '../components/teachers/MergeTeachersModal';

// Sort column type
type SortColumn = 'name' | 'phone' | 'instruments' | 'status' | null;
type SortDirection = 'asc' | 'desc';

export const TeachersPage = () => {
    const [teachers, setTeachers] = useState<Maestro[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
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
                                                        <div className="font-medium text-gray-800 dark:text-gray-200">
                                                            {teacher.name}
                                                        </div>
                                                        {teacher.email && (
                                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                                <Mail className="w-3 h-3" />
                                                                {teacher.email}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <div className="flex flex-wrap gap-1">
                                                    {teacher.primaryInstrument ? (
                                                        <span className="px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-medium">
                                                            {teacher.primaryInstrument}
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
                                            </td>
                                            <td className="px-4 py-3 text-sm hidden sm:table-cell">
                                                {teacher.phone ? (
                                                    <a href={`tel:${teacher.phone}`} className="text-teal-500 hover:underline text-xs flex items-center gap-1">
                                                        <Phone className="w-3 h-3" />
                                                        {formatPhoneNumber(teacher.phone)}
                                                    </a>
                                                ) : hasNoContact(teacher) ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium">
                                                        <PhoneOff className="w-3 h-3" />
                                                        Sin contacto
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">Solo email</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${teacher.status === 'active'
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                                    }`}>
                                                    {teacher.status === 'active' ? 'Activo' : 'Inactivo'}
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
