import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../../store';
import { ChatListItem } from './ChatListItem';
import { chatApi, contactGroupApi } from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Search, MessageSquarePlus, Filter, MoreVertical, Bot, BotOff, Users, SortDesc, X, Settings, Key, Bell, Upload, Database, LogOut, Zap } from 'lucide-react';
import { SettingsPanel } from '../settings/SettingsPanel';
import { clsx } from 'clsx';
import type { Chat, ContactGroup } from '../../types';

type QuickFilter = 'all' | 'unread' | 'favorites' | 'groups';

interface ChatListProps {
    onSelectChat?: (jid: string) => void;
}

export const ChatList = ({ onSelectChat }: ChatListProps) => {
    const {
        chats,
        setChats,
        mergeChats,
        activeChat,
        setActiveChat,
        isLoadingChats,
        setLoadingChats,
        setChatFilter,
        contactGroups,
        setContactGroups,
        setLoadingContactGroups
    } = useStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewChat, setShowNewChat] = useState(false);
    const [newChatNumber, setNewChatNumber] = useState('');
    const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [botFilter, setBotFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [selectedContactGroup, setSelectedContactGroup] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'recent' | 'unread' | 'name'>('recent');
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());

    useEffect(() => {
        const fetchChats = async (isInitial = true) => {
            // Only show loading on initial fetch
            if (isInitial && chats.length === 0) {
                setLoadingChats(true);
                setFetchError(null);
            }
            try {
                const response = await chatApi.getChats();
                if (response.data.success) {
                    const newChats = response.data.data || [];

                    // Clear error on successful fetch
                    setFetchError(null);
                    setLastFetchTime(Date.now());

                    // 🔍 DEBUG: Log API response
                    console.log('[ChatList] API Response:', {
                        count: newChats.length,
                        pagination: response.data.pagination,
                        sample: newChats.slice(0, 3).map((c: Chat) => ({
                            jid: c.jid,
                            stableKey: c.stableKey,
                            name: c.name,
                            displayName: c.displayName,
                            unreadCount: c.unreadCount
                        }))
                    });

                    if (isInitial) {
                        // Initial load: replace all chats
                        setChats(newChats);
                    } else {
                        // Refresh: merge preserving local unreadCount for active chat
                        mergeChats(newChats);
                    }
                } else {
                    setFetchError(response.data.error || 'Error al cargar chats');
                }
            } catch (error: any) {
                console.error('Failed to fetch chats:', error);
                const errorMsg = error?.response?.data?.error || error?.message || 'No se pudo conectar al servidor';
                setFetchError(errorMsg);
            } finally {
                if (isInitial && chats.length === 0) {
                    setLoadingChats(false);
                }
            }
        };

        // Initial fetch with loading
        fetchChats(true);

        // Silent background refresh every 30 seconds (no spinner)
        const interval = setInterval(() => fetchChats(false), 30000);

        // Silent refresh when window gains focus
        const handleFocus = () => {
            fetchChats(false);
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [setChats, mergeChats, setLoadingChats]);

    // Fetch contact groups on mount
    useEffect(() => {
        const fetchContactGroups = async () => {
            setLoadingContactGroups(true);
            try {
                const response = await contactGroupApi.getAll();
                if (response.data.success) {
                    setContactGroups(response.data.data || []);
                }
            } catch (error) {
                console.error('Failed to fetch contact groups:', error);
            } finally {
                setLoadingContactGroups(false);
            }
        };

        fetchContactGroups();
    }, [setContactGroups, setLoadingContactGroups]);

    // Eliminar duplicados basados en jid para evitar errores de key en React
    const uniqueChats: Chat[] = Array.from(
        new Map((chats as Chat[]).map((chat) => [chat.jid, chat])).values()
    );

    // 🔍 DEBUG: Log deduplication
    if (chats.length !== uniqueChats.length) {
        console.log('[ChatList] Deduplication:', {
            before: chats.length,
            after: uniqueChats.length,
            removed: chats.length - uniqueChats.length,
            duplicateJids: chats
                .map((c: Chat) => c.jid)
                .filter((jid: string, i: number, arr: string[]) => arr.indexOf(jid) !== i)
        });
    }

    // Apply filters with useMemo
    const filteredChats = useMemo((): Chat[] => {
        // First, apply search filter
        let result: Chat[] = uniqueChats.filter((chat: Chat) =>
            chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            chat.jid.includes(searchQuery)
        );

        const afterSearch = result.length;

        // Then, apply quick filter
        switch (quickFilter) {
            case 'unread':
                result = result.filter((chat: Chat) => chat.unreadCount > 0);
                break;
            case 'groups':
                result = result.filter((chat: Chat) => chat.isGroup === true);
                break;
            case 'favorites':
                // TODO: Implement favorites filter
                break;
            case 'all':
            default:
                break;
        }

        const afterQuickFilter = result.length;

        // Apply bot filter
        if (botFilter === 'active') {
            result = result.filter((chat: Chat) => chat.botActive === true);
        } else if (botFilter === 'inactive') {
            result = result.filter((chat: Chat) => chat.botActive === false);
        }

        const afterBotFilter = result.length;

        // Apply contact group filter
        if (selectedContactGroup) {
            const group = contactGroups.find((g: ContactGroup) => g.id === selectedContactGroup);
            if (group) {
                const contactJids = new Set(group.contacts.map((c: { jid: string }) => c.jid));
                result = result.filter((chat: Chat) => contactJids.has(chat.jid));
            }
        }

        const afterGroupFilter = result.length;

        // Apply sorting
        if (sortOrder === 'unread') {
            result = [...result].sort((a: Chat, b: Chat) => (b.unreadCount || 0) - (a.unreadCount || 0));
        } else if (sortOrder === 'name') {
            result = [...result].sort((a: Chat, b: Chat) => a.name.localeCompare(b.name));
        }
        // 'recent' is the default order from the API

        // 🔍 DEBUG: Log filtering pipeline
        if (uniqueChats.length > 0 && result.length !== afterSearch) {
            console.log('[ChatList] Filtering pipeline:', {
                unique: uniqueChats.length,
                afterSearch,
                afterQuickFilter,
                afterBotFilter,
                afterGroupFilter,
                final: result.length,
                filters: { searchQuery, quickFilter, botFilter, selectedContactGroup, sortOrder }
            });
        }

        return result;
    }, [uniqueChats, searchQuery, quickFilter, botFilter, selectedContactGroup, contactGroups, sortOrder]);

    // Check if any advanced filter is active
    const hasActiveFilters = botFilter !== 'all' || selectedContactGroup !== null || sortOrder !== 'recent';

    // Clear all advanced filters
    const clearAllFilters = () => {
        setBotFilter('all');
        setSelectedContactGroup(null);
        setSortOrder('recent');
        setShowFilterMenu(false);
    };

    const handleQuickFilterChange = (filter: QuickFilter) => {
        setQuickFilter(filter);
        // Also update global filter for compatibility
        if (filter === 'unread') {
            setChatFilter({ type: 'unread' });
        } else if (filter === 'groups') {
            setChatFilter({ type: 'groups' });
        } else {
            setChatFilter({ type: 'all' });
        }
    };

    const handleStartNewChat = () => {
        if (!newChatNumber.trim()) return;

        // Format number and create JID
        const cleanNumber = newChatNumber.replace(/\D/g, '');
        const jid = `${cleanNumber}@s.whatsapp.net`;

        setActiveChat(jid);
        setShowNewChat(false);
        setNewChatNumber('');
    };

    const handleChatClick = (jid: string) => {
        setActiveChat(jid);
        onSelectChat?.(jid);
    };

    const filterButtons: { id: QuickFilter; label: string }[] = [
        { id: 'all', label: 'Todos' },
        { id: 'unread', label: 'No leídos' },
        { id: 'favorites', label: 'Favoritos' },
        { id: 'groups', label: 'Grupos' },
    ];

    return (
        <div className="w-full bg-white dark:bg-[#111b21] flex flex-col h-full transition-colors duration-200">
            {/* Header with title and icons - Responsive spacing and layout */}
            <header
                className="flex items-center justify-between bg-gray-100 dark:bg-[#202c33] transition-colors duration-200"
                style={{
                    padding: 'clamp(0.75rem, 1vw, 1.25rem)',
                    minHeight: 'clamp(3rem, 8vw, 3.5rem)',
                    gap: 'clamp(0.5rem, 2vw, 1rem)'
                }}
            >
                <h1 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 dark:text-white flex-shrink-0">
                    Chats
                </h1>

                {/* Controls - Responsive icon buttons with touch-friendly sizing */}
                <div className="flex items-center gap-1 sm:gap-2">
                    <button
                        onClick={() => setShowNewChat(!showNewChat)}
                        className="p-2 sm:p-2.5 text-[#aebac1] hover:bg-[#374248] rounded-full transition-colors duration-150 active:scale-95 touch-highlight"
                        title="Nuevo chat"
                        aria-label="Nuevo chat"
                        aria-expanded={showNewChat}
                    >
                        <MessageSquarePlus className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setShowFilterMenu(!showFilterMenu)}
                            className={clsx(
                                "p-2 sm:p-2.5 rounded-full transition-colors duration-150 active:scale-95 touch-highlight relative",
                                showFilterMenu || hasActiveFilters
                                    ? "text-[#00a884] bg-[#374248]"
                                    : "text-[#aebac1] hover:bg-[#374248]"
                            )}
                            title="Filtros avanzados"
                            aria-label="Filtros avanzados"
                            aria-expanded={showFilterMenu}
                            aria-controls="filter-menu"
                        >
                            <Filter className="w-5 h-5 sm:w-6 sm:h-6" />
                            {hasActiveFilters && (
                                <span
                                    className="absolute top-1 right-1 w-2 h-2 bg-[#00a884] rounded-full animate-pulse"
                                    aria-hidden="true"
                                />
                            )}
                        </button>

                        {/* Filter dropdown menu - Responsive positioning */}
                        {showFilterMenu && (
                            <div
                                id="filter-menu"
                                className="absolute right-0 top-full sm:top-14 bg-[#233138] rounded-lg shadow-lg border border-[#374248] py-2 w-screen sm:min-w-[240px] sm:max-w-xs md:max-w-sm z-50 mt-1"
                                role="menu"
                            >
                                {/* Header */}
                                <div className="px-4 py-2 flex items-center justify-between border-b border-[#374248]">
                                    <span className="text-sm font-medium text-[#e9edef]">Filtros avanzados</span>
                                    <button
                                        onClick={() => setShowFilterMenu(false)}
                                        className="p-1 hover:bg-[#374248] rounded text-[#8696a0]"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Bot Status Filter */}
                                <div className="px-4 py-2 border-b border-[#374248]">
                                    <span className="text-xs text-[#8696a0] uppercase tracking-wide">Estado del Bot</span>
                                    <div className="mt-2 space-y-1">
                                        {[
                                            { value: 'all', label: 'Todos', icon: null },
                                            { value: 'active', label: 'Bot activo', icon: Bot },
                                            { value: 'inactive', label: 'Bot inactivo', icon: BotOff },
                                        ].map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => setBotFilter(option.value as 'all' | 'active' | 'inactive')}
                                                className={clsx(
                                                    "w-full px-3 py-1.5 rounded flex items-center gap-2 text-sm transition-colors",
                                                    botFilter === option.value
                                                        ? "bg-[#00a884] text-[#111b21]"
                                                        : "text-[#e9edef] hover:bg-[#374248]"
                                                )}
                                            >
                                                {option.icon && <option.icon className="w-4 h-4" />}
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Sort Order */}
                                <div className="px-4 py-2 border-b border-[#374248]">
                                    <span className="text-xs text-[#8696a0] uppercase tracking-wide">Ordenar por</span>
                                    <div className="mt-2 space-y-1">
                                        {[
                                            { value: 'recent', label: 'Más recientes' },
                                            { value: 'unread', label: 'No leídos primero' },
                                            { value: 'name', label: 'Nombre (A-Z)' },
                                        ].map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => setSortOrder(option.value as 'recent' | 'unread' | 'name')}
                                                className={clsx(
                                                    "w-full px-3 py-1.5 rounded flex items-center gap-2 text-sm transition-colors",
                                                    sortOrder === option.value
                                                        ? "bg-[#00a884] text-[#111b21]"
                                                        : "text-[#e9edef] hover:bg-[#374248]"
                                                )}
                                            >
                                                <SortDesc className="w-4 h-4" />
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Contact Groups */}
                                {contactGroups.length > 0 && (
                                    <div className="px-4 py-2 border-b border-[#374248]">
                                        <span className="text-xs text-[#8696a0] uppercase tracking-wide">Grupo de contactos</span>
                                        <div className="mt-2 space-y-1">
                                            <button
                                                onClick={() => setSelectedContactGroup(null)}
                                                className={clsx(
                                                    "w-full px-3 py-1.5 rounded flex items-center gap-2 text-sm transition-colors",
                                                    selectedContactGroup === null
                                                        ? "bg-[#00a884] text-[#111b21]"
                                                        : "text-[#e9edef] hover:bg-[#374248]"
                                                )}
                                            >
                                                Todos los contactos
                                            </button>
                                            {contactGroups.map((group: ContactGroup) => (
                                                <button
                                                    key={group.id}
                                                    onClick={() => setSelectedContactGroup(group.id)}
                                                    className={clsx(
                                                        "w-full px-3 py-1.5 rounded flex items-center gap-2 text-sm transition-colors",
                                                        selectedContactGroup === group.id
                                                            ? "bg-[#00a884] text-[#111b21]"
                                                            : "text-[#e9edef] hover:bg-[#374248]"
                                                    )}
                                                >
                                                    <Users className="w-4 h-4" />
                                                    {group.name}
                                                    <span className="ml-auto text-xs opacity-70">
                                                        {group.contacts.length}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Clear filters button */}
                                {hasActiveFilters && (
                                    <div className="px-4 py-2">
                                        <button
                                            onClick={clearAllFilters}
                                            className="w-full px-3 py-2 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30 transition-colors"
                                        >
                                            Limpiar filtros
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                            className={clsx(
                                "p-2 sm:p-2.5 rounded-full transition-colors duration-150 active:scale-95 touch-highlight",
                                showSettingsMenu
                                    ? "text-[#00a884] bg-[#374248]"
                                    : "text-[#aebac1] hover:bg-[#374248]"
                            )}
                            title="Configuración"
                            aria-label="Menú de configuración"
                            aria-expanded={showSettingsMenu}
                            aria-controls="settings-menu"
                        >
                            <MoreVertical className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>

                        {/* Settings dropdown menu - Responsive positioning */}
                        {showSettingsMenu && (
                            <div
                                id="settings-menu"
                                className="absolute right-0 top-full sm:top-14 bg-[#233138] rounded-lg shadow-lg border border-[#374248] py-2 w-screen sm:min-w-[280px] sm:max-w-xs md:max-w-sm z-50 mt-1"
                                role="menu"
                            >
                                {/* Header */}
                                <div className="px-4 py-2 flex items-center justify-between border-b border-[#374248]">
                                    <span className="text-sm font-medium text-[#e9edef]">Configuración</span>
                                    <button
                                        onClick={() => setShowSettingsMenu(false)}
                                        className="p-1 hover:bg-[#374248] rounded text-[#8696a0]"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Settings options */}
                                <div className="py-1">
                                    <button
                                        onClick={() => {
                                            setShowSettingsMenu(false);
                                            setShowSettingsPanel(true);
                                        }}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 text-[#e9edef] hover:bg-[#374248] transition-colors"
                                    >
                                        <Settings className="w-5 h-5 text-[#8696a0]" />
                                        <div className="text-left">
                                            <span className="text-sm">Ajustes generales</span>
                                            <p className="text-xs text-[#8696a0]">Tema, idioma y preferencias</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowSettingsMenu(false);
                                            setShowSettingsPanel(true);
                                        }}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 text-[#e9edef] hover:bg-[#374248] transition-colors"
                                    >
                                        <Key className="w-5 h-5 text-[#8696a0]" />
                                        <div className="text-left">
                                            <span className="text-sm">API e IA</span>
                                            <p className="text-xs text-[#8696a0]">Configurar Gemini API</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowSettingsMenu(false);
                                            setShowSettingsPanel(true);
                                        }}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 text-[#e9edef] hover:bg-[#374248] transition-colors"
                                    >
                                        <Bell className="w-5 h-5 text-[#8696a0]" />
                                        <div className="text-left">
                                            <span className="text-sm">Notificaciones</span>
                                            <p className="text-xs text-[#8696a0]">Sonidos y alertas</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowSettingsMenu(false);
                                            setShowSettingsPanel(true);
                                        }}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 text-[#e9edef] hover:bg-[#374248] transition-colors"
                                    >
                                        <Upload className="w-5 h-5 text-[#8696a0]" />
                                        <div className="text-left">
                                            <span className="text-sm">Importar contactos</span>
                                            <p className="text-xs text-[#8696a0]">Cargar desde JSON</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowSettingsMenu(false);
                                            setShowSettingsPanel(true);
                                        }}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 text-[#e9edef] hover:bg-[#374248] transition-colors"
                                    >
                                        <Users className="w-5 h-5 text-[#8696a0]" />
                                        <div className="text-left">
                                            <span className="text-sm">Grupos de contactos</span>
                                            <p className="text-xs text-[#8696a0]">Administrar grupos</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowSettingsMenu(false);
                                            setShowSettingsPanel(true);
                                        }}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 text-[#e9edef] hover:bg-[#374248] transition-colors"
                                    >
                                        <Database className="w-5 h-5 text-[#8696a0]" />
                                        <div className="text-left">
                                            <span className="text-sm">Datos y almacenamiento</span>
                                            <p className="text-xs text-[#8696a0]">Exportar y limpiar</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowSettingsMenu(false);
                                            setShowSettingsPanel(true);
                                        }}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 text-[#e9edef] hover:bg-[#374248] transition-colors"
                                    >
                                        <Zap className="w-5 h-5 text-[#8696a0]" />
                                        <div className="text-left">
                                            <span className="text-sm">Triggers</span>
                                            <p className="text-xs text-[#8696a0]">Palabras clave de activación</p>
                                        </div>
                                    </button>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-[#374248] my-1"></div>

                                {/* Logout option */}
                                <button
                                    onClick={async () => {
                                        setShowSettingsMenu(false);
                                        if (confirm('¿Cerrar sesión de WhatsApp? Esto desconectará el bot por completo y requerirá escanear un nuevo QR.')) {
                                            try {
                                                const { statusApi } = await import('../../api/client');
                                                await statusApi.logout();
                                                window.location.reload();
                                            } catch (err: any) {
                                                console.error('Logout failed:', err);
                                                alert('Error al cerrar sesión: ' + (err.message || 'Error desconocido'));
                                            }
                                        }
                                    }}
                                    className="w-full px-4 py-2.5 flex items-center gap-3 text-red-400 hover:bg-[#374248] transition-colors"
                                >
                                    <LogOut className="w-5 h-5" />
                                    <span className="text-sm">Cerrar sesión</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Search bar - Responsive padding and font size */}
            <div
                className="bg-white dark:bg-[#111b21] transition-colors duration-200 border-b border-gray-200 dark:border-[#202c33]"
                style={{
                    padding: 'clamp(0.5rem, 1vw, 0.75rem)',
                }}
            >
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#8696a0] pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Buscar o iniciar uno nuevo"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 sm:py-2 bg-gray-100 dark:bg-[#202c33] text-gray-800 dark:text-[#d1d7db] placeholder-gray-400 dark:placeholder-[#8696a0] border-none rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:ring-offset-0 transition-all duration-150"
                        aria-label="Buscar chats"
                    />
                </div>
            </div>

            {/* Filter pills - WhatsApp Web style - Responsive horizontal scroll */}
            <div
                className="flex gap-2 overflow-x-auto scrollbar-hide bg-white dark:bg-[#111b21] transition-colors duration-200 border-b border-gray-200 dark:border-[#202c33]"
                style={{
                    padding: 'clamp(0.5rem, 1vw, 0.75rem)',
                }}
                role="tablist"
                aria-label="Filtros de chat"
            >
                {filterButtons.map((filter) => (
                    <button
                        key={filter.id}
                        onClick={() => handleQuickFilterChange(filter.id)}
                        className={clsx(
                            'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 active:scale-95 touch-highlight',
                            quickFilter === filter.id
                                ? 'bg-[#00a884] text-white dark:text-[#111b21] shadow-sm'
                                : 'bg-gray-100 dark:bg-[#202c33] text-gray-600 dark:text-[#8696a0] hover:bg-gray-200 dark:hover:bg-[#2a3942]'
                        )}
                        role="tab"
                        aria-selected={quickFilter === filter.id}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {/* New chat input */}
            {showNewChat && (
                <div className="px-3 py-2 bg-white dark:bg-[#111b21] border-b border-gray-200 dark:border-[#222d34] transition-colors">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Número (ej: 18091234567)"
                            value={newChatNumber}
                            onChange={(e) => setNewChatNumber(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleStartNewChat()}
                            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-[#202c33] text-gray-800 dark:text-[#d1d7db] placeholder-gray-400 dark:placeholder-[#8696a0] border-none rounded-lg text-sm focus:outline-none transition-colors"
                            autoFocus
                        />
                        <button
                            onClick={handleStartNewChat}
                            className="px-4 py-2 bg-[#00a884] text-white dark:text-[#111b21] rounded-lg text-sm font-medium hover:bg-[#06cf9c] transition-colors"
                        >
                            Iniciar
                        </button>
                    </div>
                </div>
            )}

            {/* Error banner */}
            {fetchError && (
                <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-red-700 dark:text-red-400 flex-1">
                            ⚠️ {fetchError}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    if (confirm('¿Deseas intentar un reinicio forzado de la sesión? Usa esto si los chats no cargan tras varios intentos.')) {
                                        try {
                                            const { statusApi } = await import('../../api/client');
                                            await statusApi.logout();
                                            window.location.reload();
                                        } catch (err) {
                                            window.location.reload();
                                        }
                                    }
                                }}
                                className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                            >
                                Reiniciar Sesión
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                            >
                                Reintentar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-transparent transition-colors">
                {isLoadingChats ? (
                    <div className="flex items-center justify-center py-8">
                        <LoadingSpinner />
                    </div>
                ) : fetchError && filteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                            <MessageSquarePlus className="w-8 h-8 text-red-500 dark:text-red-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                            No se pudieron cargar los chats
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
                            {fetchError}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-[#00a884] hover:bg-[#06cf9c] text-white rounded-lg transition-colors font-medium text-sm"
                        >
                            Reintentar ahora
                        </button>
                    </div>
                ) : filteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-[#8696a0]">
                        <MessageSquarePlus className="w-12 h-12 mb-2 opacity-50" />
                        <p className="text-sm">
                            {searchQuery ? 'No se encontraron chats' : 'No hay chats'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Last update indicator */}
                        <div className="px-4 py-2 text-center border-b border-gray-100 dark:border-[#222d34]">
                            <p className="text-xs text-gray-400 dark:text-[#8696a0]">
                                Actualizado {new Date(lastFetchTime).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                        <div>
                            {filteredChats.map((chat: Chat) => (
                                <ChatListItem
                                    key={chat.jid}
                                    chat={chat}
                                    isActive={activeChat === chat.jid}
                                    onClick={() => handleChatClick(chat.jid)}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Settings Panel */}
            <SettingsPanel
                isOpen={showSettingsPanel}
                onClose={() => setShowSettingsPanel(false)}
            />
        </div>
    );
};
