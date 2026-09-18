/**
 * AppointmentsPage - Fase C of docs/SPEC_CONVERSACION_GUIADA.md
 * Shows appointments proposed by guided flows and lets a human confirm,
 * cancel or reschedule them — the bot never confirms one on its own
 * (spec section 6 and 10).
 */
import { useState, useEffect } from 'react';
import { CalendarCheck, Loader2, Check, X, CalendarClock } from 'lucide-react';
import { appointmentApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

type AppointmentStatus = 'propuesta' | 'confirmada' | 'cancelada' | 'reagendada';

interface Appointment {
    id: string;
    chatJid: string;
    contactName: string;
    type: string;
    proposedDate?: string;
    status: AppointmentStatus;
    sourceFlowId: string;
    createdAt: string;
    confirmedBy?: string;
    notes?: string;
}

const statusStyles: Record<AppointmentStatus, string> = {
    propuesta: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    confirmada: 'bg-[#00a884]/20 text-[#00a884]',
    cancelada: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    reagendada: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
};

const statusLabels: Record<AppointmentStatus, string> = {
    propuesta: 'Propuesta',
    confirmada: 'Confirmada',
    cancelada: 'Cancelada',
    reagendada: 'Reagendada'
};

export const AppointmentsPage = () => {
    const { currentUser } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rescheduling, setRescheduling] = useState<string | null>(null);
    const [newDate, setNewDate] = useState('');
    const [filter, setFilter] = useState<'all' | AppointmentStatus>('all');

    useEffect(() => {
        loadAppointments();
    }, []);

    const loadAppointments = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await appointmentApi.getAll();
            if (response.data.success) setAppointments(response.data.data || []);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async (id: string) => {
        try {
            await appointmentApi.confirm(id, currentUser?.email || 'admin');
            await loadAppointments();
        } catch (err: any) {
            alert('Error: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleCancel = async (id: string) => {
        const notes = prompt('¿Motivo de cancelación? (opcional)') || undefined;
        try {
            await appointmentApi.cancel(id, notes);
            await loadAppointments();
        } catch (err: any) {
            alert('Error: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleReschedule = async (id: string) => {
        if (!newDate.trim()) return;
        try {
            await appointmentApi.reschedule(id, newDate.trim());
            setRescheduling(null);
            setNewDate('');
            await loadAppointments();
        } catch (err: any) {
            alert('Error: ' + (err.response?.data?.error || err.message));
        }
    };

    const filtered = filter === 'all' ? appointments : appointments.filter(a => a.status === filter);

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <CalendarCheck className="w-6 h-6 text-[#00a884]" />
                <div>
                    <h1 className="text-xl font-semibold text-gray-800 dark:text-[#e9edef]">Citas</h1>
                    <p className="text-sm text-gray-500 dark:text-[#8696a0]">
                        Propuestas por los flujos guiados — la confirmación siempre es manual (Fase C)
                    </p>
                </div>
            </div>

            <div className="flex gap-2 mb-4">
                {(['all', 'propuesta', 'confirmada', 'reagendada', 'cancelada'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === f
                            ? 'bg-[#00a884] text-white'
                            : 'bg-gray-100 dark:bg-[#202c33] text-gray-600 dark:text-[#aebac1]'}`}
                    >
                        {f === 'all' ? 'Todas' : statusLabels[f]}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 text-[#00a884] animate-spin" />
                </div>
            ) : error ? (
                <p className="text-red-500 text-sm">{error}</p>
            ) : filtered.length === 0 ? (
                <p className="text-gray-500 dark:text-[#8696a0] text-sm">
                    Sin citas todavía. Se crean automáticamente cuando un flujo guiado (Fase B) cumple su condición de éxito.
                </p>
            ) : (
                <div className="space-y-3">
                    {filtered.map(appt => (
                        <div
                            key={appt.id}
                            className="p-4 bg-white dark:bg-[#202c33] border border-gray-200 dark:border-[#374248] rounded-lg"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-medium text-gray-800 dark:text-[#e9edef]">{appt.contactName}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyles[appt.status]}`}>
                                            {statusLabels[appt.status]}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-[#d1d7db] mt-1">
                                        {appt.type} {appt.proposedDate ? `· ${appt.proposedDate}` : '(sin fecha capturada)'}
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-[#8696a0]">
                                        flujo: {appt.sourceFlowId} · creada {new Date(appt.createdAt).toLocaleString('es')}
                                        {appt.confirmedBy ? ` · confirmada por ${appt.confirmedBy}` : ''}
                                    </p>
                                    {appt.notes && (
                                        <p className="text-xs text-gray-500 dark:text-[#8696a0] mt-1">Nota: {appt.notes}</p>
                                    )}
                                </div>

                                {(appt.status === 'propuesta' || appt.status === 'reagendada') && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleConfirm(appt.id)}
                                            title="Confirmar"
                                            className="p-2 text-[#00a884] hover:bg-[#00a884]/10 rounded-full transition-colors"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setRescheduling(rescheduling === appt.id ? null : appt.id)}
                                            title="Reagendar"
                                            className="p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                                        >
                                            <CalendarClock className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleCancel(appt.id)}
                                            title="Cancelar"
                                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {rescheduling === appt.id && (
                                <div className="flex gap-2 mt-3">
                                    <input
                                        type="text"
                                        value={newDate}
                                        onChange={e => setNewDate(e.target.value)}
                                        placeholder="Nueva fecha (ej. 20/10/2026)"
                                        className="flex-1 px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-sm text-gray-800 dark:text-[#e9edef]"
                                    />
                                    <button
                                        onClick={() => handleReschedule(appt.id)}
                                        disabled={!newDate.trim()}
                                        className="px-3 py-2 bg-[#00a884] text-white rounded-lg text-sm font-medium hover:bg-[#06cf9c] disabled:opacity-50"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
