/**
 * Tickets Panel
 * Gestión de tickets de soporte escalados
 */

import { useState, useEffect } from 'react';
import { 
    Ticket, Clock, CheckCircle, 
    MessageSquare, Send, RefreshCw, User
} from 'lucide-react';
import { escalationApi } from '../../api/client';

interface EscalationTicket {
    id: string;
    chatJid: string;
    customerName: string;
    customerPhone: string;
    originalMessage: string;
    status: 'pending' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assignedTo?: string;
    adminResponse?: string;
    createdAt: string;
    resolvedAt?: string;
}

interface Admin {
    jid: string;
    name: string;
    role: string;
    isActive: boolean;
}

const priorityColors = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700'
};

const statusColors = {
    pending: 'bg-gray-100 text-gray-700',
    assigned: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-purple-100 text-purple-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-500'
};

const statusLabels = {
    pending: 'Pendiente',
    assigned: 'Asignado',
    in_progress: 'En Progreso',
    resolved: 'Resuelto',
    closed: 'Cerrado'
};

export const TicketsPanel = () => {
    const [tickets, setTickets] = useState<EscalationTicket[]>([]);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<EscalationTicket | null>(null);
    const [responseText, setResponseText] = useState('');
    const [shouldLearn, setShouldLearn] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [priorityFilter, setPriorityFilter] = useState<string>('');
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [ticketsRes, adminsRes, statsRes] = await Promise.all([
                escalationApi.getTickets(),
                escalationApi.getAdmins(),
                escalationApi.getStats()
            ]);
            setTickets(ticketsRes.data.data || []);
            setAdmins(adminsRes.data.data || []);
            setStats(statsRes.data.data);
        } catch (error) {
            console.error('Error loading tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleResolveTicket = async () => {
        if (!selectedTicket || !responseText.trim()) return;

        try {
            await escalationApi.resolveTicket(selectedTicket.id, responseText, shouldLearn);
            setSelectedTicket(null);
            setResponseText('');
            setShouldLearn(false);
            loadData();
        } catch (error) {
            console.error('Error resolving ticket:', error);
        }
    };

    const handleAssignTicket = async (ticketId: string, adminJid: string) => {
        try {
            await escalationApi.assignTicket(ticketId, adminJid);
            loadData();
        } catch (error) {
            console.error('Error assigning ticket:', error);
        }
    };

    const filteredTickets = tickets.filter(ticket => {
        if (statusFilter && ticket.status !== statusFilter) return false;
        if (priorityFilter && ticket.priority !== priorityFilter) return false;
        return true;
    });

    const pendingCount = tickets.filter(t => t.status === 'pending').length;
    const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved').length;

    return (
        <div className="h-full flex bg-gray-50 dark:bg-gray-800">
            {/* Tickets List */}
            <div className="w-1/2 border-r flex flex-col">
                {/* Header */}
                <div className="bg-white border-b p-4 dark:bg-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Ticket className="w-6 h-6 text-whatsapp-green dark:text-gray-800" />
                            <h2 className="text-xl font-semibold dark:text-gray-100">Tickets de Soporte</h2>
                        </div>
                        <button
                            onClick={loadData}
                            className="p-2 hover:bg-gray-600 rounded-lg"
                        >
                            <RefreshCw className="w-5 h-5  " />
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="bg-gray-50 rounded-lg p-2 text-center dark:bg-gray-600">
                            <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">{stats?.total || 0}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-100">Total</p>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-2 text-center dark:bg-yellow-700">
                            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-200">{pendingCount}</p>
                            <p className="text-xs text-gray-500 dark:text-yellow-100">Pendientes</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-2 text-center dark:bg-red-700">
                            <p className="text-2xl font-bold text-red-600 dark:text-red-200">{urgentCount}</p>
                            <p className="text-xs text-gray-500 dark:text-red-100">Urgentes</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-2 text-center dark:bg-green-600">
                            <p className="text-2xl font-bold text-green-600 dark:text-green-200">{stats?.resolved || 0}</p>
                            <p className="text-xs text-gray-500 dark:text-green-100">Resueltos</p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        >
                            <option value="">Todos los estados</option>
                            <option value="pending">Pendientes</option>
                            <option value="assigned">Asignados</option>
                            <option value="in_progress">En Progreso</option>
                            <option value="resolved">Resueltos</option>
                        </select>
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        >
                            <option value="">Todas las prioridades</option>
                            <option value="urgent">Urgente</option>
                            <option value="high">Alta</option>
                            <option value="medium">Media</option>
                            <option value="low">Baja</option>
                        </select>
                    </div>
                </div>

                {/* Tickets List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <RefreshCw className="w-8 h-8 animate-spin text-whatsapp-green" />
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="text-center py-12">
                            <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                            <p className="text-gray-500 dark:text-gray-100">No hay tickets pendientes</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filteredTickets.map(ticket => (
                                <div
                                    key={ticket.id}
                                    onClick={() => setSelectedTicket(ticket)}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                                        selectedTicket?.id === ticket.id ? 'bg-blue-50' : ''
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-gray-400" />
                                            <span className="font-medium">{ticket.customerName}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <span className={`text-xs px-2 py-1 rounded ${priorityColors[ticket.priority]}`}>
                                                {ticket.priority}
                                            </span>
                                            <span className={`text-xs px-2 py-1 rounded ${statusColors[ticket.status]}`}>
                                                {statusLabels[ticket.status]}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                        {ticket.originalMessage}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(ticket.createdAt).toLocaleString()}
                                        </span>
                                        {ticket.assignedTo && (
                                            <span>
                                                Asignado a: {admins.find(a => a.jid === ticket.assignedTo)?.name || 'Admin'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Ticket Detail */}
            <div className="w-1/2 flex flex-col bg-white dark:bg-gray-700">
                {selectedTicket ? (
                    <>
                        {/* Ticket Header */}
                        <div className="border-b p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-semibold">{selectedTicket.customerName}</h3>
                                <div className="flex gap-2">
                                    <span className={`text-xs px-2 py-1 rounded ${priorityColors[selectedTicket.priority]}`}>
                                        {selectedTicket.priority.toUpperCase()}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded ${statusColors[selectedTicket.status]}`}>
                                        {statusLabels[selectedTicket.status]}
                                    </span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500">
                                📱 {selectedTicket.customerPhone} • 
                                🕐 {new Date(selectedTicket.createdAt).toLocaleString()}
                            </p>
                        </div>

                        {/* Ticket Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="bg-gray-50 rounded-lg p-4 mb-4 dark:bg-gray-700">
                                <p className="text-sm font-medium text-gray-500 mb-2">Mensaje Original:</p>
                                <p className="text-gray-800 whitespace-pre-wrap">{selectedTicket.originalMessage}</p>
                            </div>

                            {selectedTicket.adminResponse && (
                                <div className="bg-green-50 rounded-lg p-4 mb-4 dark:bg-green-900/20">
                                    <p className="text-sm font-medium text-green-600 mb-2">Respuesta Enviada:</p>
                                    <p className="text-gray-800 whitespace-pre-wrap">{selectedTicket.adminResponse}</p>
                                </div>
                            )}

                            {/* Assign Admin */}
                            {selectedTicket.status === 'pending' && (
                                <div className="mb-4">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Asignar a:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {admins.filter(a => a.isActive).map(admin => (
                                            <button
                                                key={admin.jid}
                                                onClick={() => handleAssignTicket(selectedTicket.id, admin.jid)}
                                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
                                            >
                                                {admin.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Response Input */}
                        {['pending', 'assigned', 'in_progress'].includes(selectedTicket.status) && (
                            <div className="border-t p-4">
                                <textarea
                                    value={responseText}
                                    onChange={(e) => setResponseText(e.target.value)}
                                    placeholder="Escribe tu respuesta..."
                                    rows={3}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green resize-none mb-3"
                                />
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-sm text-gray-600">
                                        <input
                                            type="checkbox"
                                            checked={shouldLearn}
                                            onChange={(e) => setShouldLearn(e.target.checked)}
                                            className="rounded"
                                        />
                                        Guardar en base de conocimiento
                                    </label>
                                    <button
                                        onClick={handleResolveTicket}
                                        disabled={!responseText.trim()}
                                        className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50"
                                    >
                                        <Send className="w-4 h-4" />
                                        Enviar y Resolver
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4 dark:text-gray-100" />
                            <p className="text-gray-500 dark:text-gray-200">Selecciona un ticket para ver los detalles</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TicketsPanel;
