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
    const [showDetails, setShowDetails] = useState(false);

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
        <div 
            className="h-full w-full flex flex-col lg:flex-row gap-0 bg-gray-50 dark:bg-gray-800"
            role="region"
            aria-label="Tickets de soporte"
        >
            {/* Tickets List - Full width on mobile, partial on larger screens */}
            <div 
                className={`
                    w-full lg:w-2/5 xl:w-1/3 
                    border-b lg:border-b-0 lg:border-r 
                    border-gray-200 dark:border-gray-600
                    flex flex-col
                    ${selectedTicket && !showDetails ? 'lg:block' : ''}
                    hidden md:flex
                    lg:flex
                `}
            >
                {/* Header - Responsive */}
                <header 
                    className="bg-white dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex-shrink-0"
                    style={{
                        padding: 'clamp(0.75rem, 1vw, 1rem)',
                    }}
                >
                    <div className="flex items-center justify-between gap-2 mb-clamp">
                        <div className="flex items-center gap-2 min-w-0">
                            <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-whatsapp-green flex-shrink-0" />
                            <h3 className="font-semibold text-gray-800 dark:text-gray-100 truncate text-sm sm:text-base">
                                Tickets
                            </h3>
                        </div>
                        <button
                            onClick={loadData}
                            className="p-2 sm:p-2.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors flex-shrink-0"
                            aria-label="Actualizar tickets"
                            title="Actualizar tickets"
                        >
                            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    </div>

                    {/* Stats Grid - Responsive columns */}
                    <div 
                        className="grid gap-2 mb-3 sm:mb-4"
                        style={{
                            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                        }}
                    >
                        <div className="bg-gray-50 dark:bg-gray-600 rounded-lg p-2 sm:p-2.5 text-center">
                            <p className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-200">
                                {stats?.total || 0}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-300">Total</p>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-700 rounded-lg p-2 sm:p-2.5 text-center">
                            <p className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-200">
                                {pendingCount}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-yellow-100">Pendientes</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-700 rounded-lg p-2 sm:p-2.5 text-center">
                            <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-200">
                                {urgentCount}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-red-100">Urgentes</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-600 rounded-lg p-2 sm:p-2.5 text-center">
                            <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-200">
                                {stats?.resolved || 0}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-green-100">Resueltos</p>
                        </div>
                    </div>

                    {/* Filters - Stack on mobile, side-by-side on tablet+ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-2.5 sm:px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-lg text-xs sm:text-sm bg-white dark:bg-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
                            aria-label="Filtrar por estado"
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
                            className="px-2.5 sm:px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-lg text-xs sm:text-sm bg-white dark:bg-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
                            aria-label="Filtrar por prioridad"
                        >
                            <option value="">Todas las prioridades</option>
                            <option value="urgent">Urgente</option>
                            <option value="high">Alta</option>
                            <option value="medium">Media</option>
                            <option value="low">Baja</option>
                        </select>
                    </div>
                </header>

                {/* Tickets List - Scrollable */}
                <div 
                    className="flex-1 overflow-y-auto"
                    role="list"
                    aria-label="Lista de tickets"
                >
                    {loading ? (
                        <div className="flex items-center justify-center h-32 sm:h-48">
                            <div className="flex flex-col items-center gap-2">
                                <RefreshCw className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-whatsapp-green" />
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Cargando...</p>
                            </div>
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="text-center py-8 sm:py-12">
                            <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-300 mx-auto mb-3 sm:mb-4" />
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                                No hay tickets pendientes
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-600">
                            {filteredTickets.map(ticket => (
                                <button
                                    key={ticket.id}
                                    onClick={() => {
                                        setSelectedTicket(ticket);
                                        setShowDetails(true);
                                    }}
                                    className={`
                                        w-full p-3 sm:p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600
                                        transition-colors text-left
                                        active:scale-95 sm:active:scale-100
                                        ${
                                            selectedTicket?.id === ticket.id 
                                                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' 
                                                : ''
                                        }
                                    `}
                                    aria-selected={selectedTicket?.id === ticket.id}
                                    role="listitem"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                                            <span className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-100 truncate">
                                                {ticket.customerName}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 mb-2 flex-wrap">
                                        <span className={`text-xs px-2 py-0.5 rounded ${priorityColors[ticket.priority]}`}>
                                            {ticket.priority}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${statusColors[ticket.status]}`}>
                                            {statusLabels[ticket.status]}
                                        </span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                                        {ticket.originalMessage}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(ticket.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Ticket Detail - Hidden on mobile by default, toggle with button */}
            <div 
                className={`
                    w-full lg:w-3/5 xl:w-2/3 
                    flex flex-col bg-white dark:bg-gray-700
                    ${!selectedTicket ? 'hidden lg:flex' : 'flex'}
                `}
                role="region"
                aria-label="Detalles del ticket"
            >
                {selectedTicket ? (
                    <>
                        {/* Mobile Close & List Button */}
                        <div className="lg:hidden flex-shrink-0 border-b border-gray-200 dark:border-gray-600 px-3 sm:px-4 py-2 flex gap-2">
                            <button
                                onClick={() => {
                                    setShowDetails(false);
                                    setSelectedTicket(null);
                                }}
                                className="flex-1 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                aria-label="Volver a la lista"
                            >
                                ← Volver
                            </button>
                        </div>

                        {/* Ticket Header - Responsive */}
                        <header 
                            className="border-b border-gray-200 dark:border-gray-600 flex-shrink-0"
                            style={{
                                padding: 'clamp(0.75rem, 1vw, 1rem)',
                            }}
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">
                                    {selectedTicket.customerName}
                                </h3>
                                <div className="flex gap-1 flex-wrap">
                                    <span className={`text-xs px-2 py-1 rounded ${priorityColors[selectedTicket.priority]}`}>
                                        {selectedTicket.priority.toUpperCase()}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded ${statusColors[selectedTicket.status]}`}>
                                        {statusLabels[selectedTicket.status]}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                📱 {selectedTicket.customerPhone} • 
                                🕐 {new Date(selectedTicket.createdAt).toLocaleString()}
                            </p>
                        </header>

                        {/* Ticket Content - Scrollable */}
                        <div className="flex-1 overflow-y-auto">
                            <div 
                                className="p-3 sm:p-4"
                                style={{
                                    padding: 'clamp(0.75rem, 1vw, 1rem)',
                                }}
                            >
                                {/* Original Message */}
                                <div className="bg-gray-50 dark:bg-gray-600 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                                        Mensaje Original:
                                    </p>
                                    <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">
                                        {selectedTicket.originalMessage}
                                    </p>
                                </div>

                                {/* Response */}
                                {selectedTicket.adminResponse && (
                                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 border border-green-200 dark:border-green-800">
                                        <p className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                                            Respuesta Enviada:
                                        </p>
                                        <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">
                                            {selectedTicket.adminResponse}
                                        </p>
                                    </div>
                                )}

                                {/* Assign Admin */}
                                {selectedTicket.status === 'pending' && (
                                    <div className="mb-3 sm:mb-4">
                                        <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Asignar a:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {admins.filter(a => a.isActive).map(admin => (
                                                <button
                                                    key={admin.jid}
                                                    onClick={() => handleAssignTicket(selectedTicket.id, admin.jid)}
                                                    className="px-3 py-1.5 sm:py-2 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-700 text-xs sm:text-sm font-medium transition-colors active:scale-95"
                                                    aria-label={`Asignar a ${admin.name}`}
                                                >
                                                    {admin.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Response Input - Responsive */}
                        {['pending', 'assigned', 'in_progress'].includes(selectedTicket.status) && (
                            <footer 
                                className="border-t border-gray-200 dark:border-gray-600 flex-shrink-0"
                                style={{
                                    padding: 'clamp(0.75rem, 1vw, 1rem)',
                                }}
                            >
                                <textarea
                                    value={responseText}
                                    onChange={(e) => setResponseText(e.target.value)}
                                    placeholder="Escribe tu respuesta..."
                                    rows={3}
                                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green dark:bg-gray-600 dark:text-gray-100 resize-none mb-3"
                                    aria-label="Respuesta al ticket"
                                />
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={shouldLearn}
                                            onChange={(e) => setShouldLearn(e.target.checked)}
                                            className="rounded w-4 h-4 sm:w-5 sm:h-5 cursor-pointer"
                                            aria-label="Guardar en base de conocimiento"
                                        />
                                        <span>Guardar en KB</span>
                                    </label>
                                    <button
                                        onClick={handleResolveTicket}
                                        disabled={!responseText.trim()}
                                        className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors active:scale-95"
                                        aria-label="Enviar respuesta y resolver ticket"
                                    >
                                        <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        <span>Enviar</span>
                                    </button>
                                </div>
                            </footer>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center px-4 py-8">
                        <div className="text-center">
                            <MessageSquare className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 dark:text-gray-500 mx-auto mb-3 sm:mb-4" />
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                Selecciona un ticket para ver los detalles
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TicketsPanel;
