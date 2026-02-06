/**
 * RoomsPage - Manage rooms/classrooms
 * Connected directly to Firestore SALONES collection
 */

import { useState, useEffect, useCallback } from 'react';
import {
    DoorOpen, Plus, Edit2, Trash2, RefreshCw,
    Search, AlertCircle, Users, X, Save
} from 'lucide-react';
import { salonesService, Salon } from '../services/firestore';

const ROOM_COLORS = [
    { value: '#8B5CF6', label: 'Púrpura' },
    { value: '#3B82F6', label: 'Azul' },
    { value: '#10B981', label: 'Verde' },
    { value: '#F59E0B', label: 'Amarillo' },
    { value: '#EF4444', label: 'Rojo' },
    { value: '#EC4899', label: 'Rosa' },
    { value: '#06B6D4', label: 'Cian' },
    { value: '#84CC16', label: 'Lima' },
];

export const RoomsPage = () => {
    const [rooms, setRooms] = useState<Salon[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingRoom, setEditingRoom] = useState<Partial<Salon> | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Load rooms from Firestore
    const loadRooms = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await salonesService.getAllSalones();
            setRooms(data);
        } catch (err: any) {
            console.error('Error loading rooms:', err);
            setError('Error al cargar los salones. Verifica la conexión con Firebase.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRooms();
    }, [loadRooms]);

    // Save room
    const handleSave = async () => {
        if (!editingRoom || !editingRoom.nombre) return;

        setSaving(true);
        setError(null);

        try {
            if (editingId) {
                await salonesService.update(editingId, editingRoom);
            } else {
                await salonesService.create(editingRoom as Omit<Salon, 'id'>);
            }
            await loadRooms();
            closeModal();
        } catch (err: any) {
            console.error('Error saving room:', err);
            setError(err.message || 'Error al guardar el salón');
        } finally {
            setSaving(false);
        }
    };

    // Delete room
    const deleteRoom = async (id: string) => {
        setDeleting(true);
        try {
            await salonesService.delete(id);
            await loadRooms();
            setConfirmDeleteId(null);
        } catch (err: any) {
            console.error('Error deleting room:', err);
            setError(err.message || 'Error al eliminar el salón');
        } finally {
            setDeleting(false);
        }
    };

    const openNewRoom = () => {
        setEditingRoom({
            nombre: '',
            capacidad: 10,
            descripcion: '',
            equipamiento: [],
            activo: true,
            disponible: true,
            tipo: 'aula'
        });
        setEditingId(null);
        setShowModal(true);
        setError(null);
    };

    const openEditRoom = (room: Salon) => {
        setEditingRoom({ ...room });
        setEditingId(room.id);
        setShowModal(true);
        setError(null);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingRoom(null);
        setEditingId(null);
    };

    const updateField = (field: keyof Salon, value: any) => {
        if (editingRoom) {
            setEditingRoom({ ...editingRoom, [field]: value });
        }
    };

    const filteredRooms = rooms.filter(room => {
        const search = searchTerm.toLowerCase();
        return room.nombre.toLowerCase().includes(search) ||
            room.descripcion?.toLowerCase().includes(search) ||
            room.equipamiento?.some(e => e.toLowerCase().includes(search));
    });

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <DoorOpen className="w-6 h-6 text-indigo-500" />
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                            Salones
                        </h1>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({rooms.length} en Firestore)
                        </span>
                    </div>
                    <button
                        onClick={openNewRoom}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Salón
                    </button>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, equipo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                            <AlertCircle className="w-5 h-5" />
                            <span>{error}</span>
                            <button onClick={() => setError(null)} className="ml-auto">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                ) : filteredRooms.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredRooms.map((room) => (
                            <div
                                key={room.id}
                                className={`bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden ${!room.activo ? 'opacity-70' : ''
                                    }`}
                            >
                                <div
                                    className="h-2"
                                    style={{ backgroundColor: ROOM_COLORS.find(c => room.tipo?.includes(c.label.toLowerCase()))?.value || '#8B5CF6' }}
                                />
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                                                {room.nombre}
                                            </h3>
                                            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                                                <Users className="w-3 h-3" />
                                                <span>Capacidad: {room.capacidad || 'N/A'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => openEditRoom(room)}
                                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4 text-blue-500" />
                                            </button>
                                            <button
                                                onClick={() => setConfirmDeleteId(room.id)}
                                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </button>
                                        </div>
                                    </div>

                                    {room.descripcion && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                                            {room.descripcion}
                                        </p>
                                    )}

                                    {room.equipamiento && room.equipamiento.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {room.equipamiento.slice(0, 3).map((eq, i) => (
                                                <span
                                                    key={i}
                                                    className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                                                >
                                                    {eq}
                                                </span>
                                            ))}
                                            {room.equipamiento.length > 3 && (
                                                <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                                                    +{room.equipamiento.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <span className={`inline-block px-2 py-0.5 text-xs rounded ${room.activo && room.disponible
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                        : !room.activo
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                        }`}>
                                        {room.activo && room.disponible ? 'Disponible' : !room.activo ? 'Inactivo' : 'Ocupado'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-8 text-center">
                        <DoorOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">
                            No hay salones
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            {searchTerm
                                ? 'No se encontraron salones con los filtros aplicados'
                                : 'Comienza registrando tu primer salón'}
                        </p>
                        <button
                            onClick={openNewRoom}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                        >
                            Agregar Salón
                        </button>
                    </div>
                )}

                {/* Modal */}
                {showModal && editingRoom && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                                    {editingId ? 'Editar Salón' : 'Nuevo Salón'}
                                </h3>
                                <button
                                    onClick={closeModal}
                                    className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Nombre del Salón *
                                    </label>
                                    <input
                                        type="text"
                                        value={editingRoom.nombre || ''}
                                        onChange={(e) => updateField('nombre', e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Ej: Salón Principal"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Capacidad *
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={editingRoom.capacidad || 10}
                                            onChange={(e) => updateField('capacidad', parseInt(e.target.value) || 1)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Tipo
                                        </label>
                                        <input
                                            type="text"
                                            value={editingRoom.tipo || ''}
                                            onChange={(e) => updateField('tipo', e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Ej: Aula, Estudio"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Descripción
                                    </label>
                                    <textarea
                                        value={editingRoom.descripcion || ''}
                                        onChange={(e) => updateField('descripcion', e.target.value)}
                                        rows={2}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                        placeholder="Descripción del salón..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Equipamiento (separado por comas)
                                    </label>
                                    <input
                                        type="text"
                                        value={editingRoom.equipamiento?.join(', ') || ''}
                                        onChange={(e) => updateField('equipamiento',
                                            e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                        )}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Ej: Piano, Atriles, Proyector"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Activo
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={editingRoom.activo ?? true}
                                            onChange={(e) => updateField('activo', e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Disponible
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={editingRoom.disponible ?? true}
                                            onChange={(e) => updateField('disponible', e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 p-4 border-t dark:border-gray-700">
                                <button
                                    onClick={closeModal}
                                    className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!editingRoom.nombre || saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
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
                                ¿Eliminar Salón?
                            </h3>
                            <p className="text-center text-gray-500 dark:text-gray-400 mb-6">
                                Esta acción eliminará el salón de forma <strong>definitiva</strong> en Firestore. No se puede deshacer.
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
                                    onClick={() => deleteRoom(confirmDeleteId)}
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
