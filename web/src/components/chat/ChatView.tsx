import { useEffect, useRef, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { useStore } from '../../store';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { chatApi } from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { User, Users, Bot, BotOff, ArrowLeft, Search, MoreVertical, ChevronDown, Settings, X, ChevronUp } from 'lucide-react';
import { SettingsModal } from '../settings/SettingsModal';
import { BotAssignmentPanel } from '../bot';
import { ChatSettingsModal } from './ChatSettingsModal';
import type { Chat, Message } from '../../types';
import { getChatTitle, isGroupChat } from '../../utils/chatTitle';

interface ChatViewProps {
    onBack?: () => void;
    showBackButton?: boolean;
}

export const ChatView = ({ onBack, showBackButton }: ChatViewProps) => {
    const {
        activeChat,
        messages,
        setMessages,
        chats,
        isLoadingMessages,
        setLoadingMessages,
        setChatBotActive,
        markChatAsRead
    } = useStore();
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const unreadSeparatorRef = useRef<HTMLDivElement>(null);
    
    // Bottom sentinel ref for IntersectionObserver
    const bottomSentinelRef = useRef<HTMLDivElement>(null);
    
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showBotConfig, setShowBotConfig] = useState(false);
    const lastMessageCountRef = useRef<number>(0);
    const isInitialLoadRef = useRef<boolean>(true);
    const hasMarkedAsReadRef = useRef<boolean>(false);
    const [initialUnreadCount, setInitialUnreadCount] = useState(0);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    
    // NEW: Track if user is at bottom using IntersectionObserver (more reliable than scroll calc)
    const [isAtBottom, setIsAtBottom] = useState(true);
    
    // NEW: Track new messages received while scrolled up
    const [newMessagesWhileAway, setNewMessagesWhileAway] = useState(0);
    
    // NEW: History loading state
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const [oldestLoadedMessageId, setOldestLoadedMessageId] = useState<string | null>(null);
    
    // Search in chat state
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<number[]>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);
    
    // Per-chat settings modal
    const [showChatSettings, setShowChatSettings] = useState(false);
    
    const isNearBottomRef = useRef<boolean>(true);
    const initialUnreadCountRef = useRef<number>(0);

    const currentChat = chats.find((c: Chat) => c.jid === activeChat);
    const chatMessages = activeChat ? messages[activeChat] || [] : [];

    /**
     * Get activity status based on last message timestamp.
     * 
     * WHY NOT REAL "ONLINE" STATUS:
     * We don't have reliable WhatsApp presence data (online/last seen).
     * Baileys presence events are inconsistent and would require always-on
     * subscriptions. Instead, we show honest activity based on message history.
     * 
     * @param lastMessageTime - Unix timestamp in SECONDS (from backend)
     */
    const getActivityStatus = (lastMessageTime?: number): string => {
        if (!lastMessageTime) {
            return 'Sin actividad registrada';
        }

        // Convert seconds to milliseconds for Date comparison
        const lastActivityMs = lastMessageTime * 1000;
        const nowMs = Date.now();
        const diffMs = nowMs - lastActivityMs;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        // Active now: < 2 minutes
        if (diffMinutes < 2) {
            return 'Activo ahora';
        }

        // Active X minutes ago: < 60 minutes
        if (diffMinutes < 60) {
            return `Activo hace ${diffMinutes} min`;
        }

        // Format as time/date for older activity
        const lastDate = new Date(lastActivityMs);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const isSameDay = (d1: Date, d2: Date) =>
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();

        // Same day: show time
        if (isSameDay(lastDate, today)) {
            return `Hoy ${lastDate.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        }

        // Yesterday
        if (isSameDay(lastDate, yesterday)) {
            return 'Ayer';
        }

        // Older: show date
        return lastDate.toLocaleDateString('es', { day: 'numeric', month: 'numeric', year: 'numeric' });
    };

    // Calculate the index where unread messages start
    const unreadStartIndex = chatMessages.length > 0 && initialUnreadCount > 0
        ? Math.max(0, chatMessages.length - initialUnreadCount)
        : -1;

    // Load historical messages with pagination
    const loadHistory = useCallback(async (beforeMessageId?: string) => {
        if (!activeChat || isLoadingHistory || !hasMoreHistory) return;

        setIsLoadingHistory(true);

        try {
            console.log(`Loading history for ${activeChat}${beforeMessageId ? ` before ${beforeMessageId}` : ''}`);
            
            const response = await chatApi.getChatHistory(
                activeChat, 
                50, // Load 50 messages at a time
                beforeMessageId,
                true // Include media information
            );

            if (response.data.success) {
                const historyMessages = response.data.data || [];
                const newHasMore = response.data.hasMore || false;
                
                console.log(`Loaded ${historyMessages.length} historical messages for ${activeChat}`);

                if (historyMessages.length > 0) {
                    // Get current messages and prepend historical messages
                    const currentMessages = messages[activeChat] || [];
                    const combinedMessages = [...historyMessages, ...currentMessages];
                    
                    // Update messages state
                    setMessages(activeChat, combinedMessages);
                    
                    // Update oldest message ID for next pagination
                    const oldestMessage = historyMessages[0];
                    if (oldestMessage?.id) {
                        setOldestLoadedMessageId(oldestMessage.id);
                    }

                    setHasMoreHistory(newHasMore);
                } else {
                    setHasMoreHistory(false);
                }
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [activeChat, isLoadingHistory, hasMoreHistory, setMessages]);

    

    // Mark all messages as read via API and update local state
    const markAllAsRead = useCallback(async () => {
        if (!activeChat || hasMarkedAsReadRef.current) return;

        // Check current unread count from the chat
        const chat = chats.find((c: Chat) => c.jid === activeChat);
        const currentUnreadCount = chat?.unreadCount || initialUnreadCount;

        if (currentUnreadCount === 0) return;

        hasMarkedAsReadRef.current = true;

        try {
            // Update local state immediately for instant UI feedback
            markChatAsRead(activeChat);
            // Then sync with backend
            await chatApi.markAsRead(activeChat);
        } catch (error) {
            console.error('Failed to mark messages as read:', error);
            hasMarkedAsReadRef.current = false;
        }
    }, [activeChat, initialUnreadCount, markChatAsRead, chats]);

    // Handle scroll to detect when user reaches top or bottom
    const handleScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        // Check if scrolled near bottom (within 100px)
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        const isNearBottom = distanceFromBottom < 100;
        
        // Check if scrolled near top (within 100px) for loading history
        const isAtTop = container.scrollTop < 100;

        // Update ref for use in refresh logic
        isNearBottomRef.current = isNearBottom;

        // Show/hide scroll to bottom button (show when more than 300px from bottom)
        setShowScrollToBottom(distanceFromBottom > 300);

        // Load more history when at top
        if (isAtTop && hasMoreHistory && !isLoadingHistory) {
            loadHistory(oldestLoadedMessageId || undefined);
        }

        // Mark as read when near bottom
        if (isNearBottom && initialUnreadCount > 0 && !hasMarkedAsReadRef.current) {
            markAllAsRead();
        }
    }, [initialUnreadCount, markAllAsRead, hasMoreHistory, isLoadingHistory, oldestLoadedMessageId, loadHistory]);

    // Scroll to bottom function
    const scrollToBottom = useCallback((smooth = true) => {
        messagesEndRef.current?.scrollIntoView({
            behavior: smooth ? 'smooth' : 'auto'
        });
    }, []);

    // Attach scroll listener
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    // IntersectionObserver for bottom sentinel - RELIABLE bottom detection
    // This is more accurate than scroll position calculations
    useEffect(() => {
        const sentinel = bottomSentinelRef.current;
        const container = messagesContainerRef.current;
        if (!sentinel || !container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                const atBottom = entry.isIntersecting;
                
                setIsAtBottom(atBottom);
                isNearBottomRef.current = atBottom;
                
                // When user scrolls back to bottom, clear new messages indicator and mark as read
                if (atBottom && newMessagesWhileAway > 0) {
                    setNewMessagesWhileAway(0);
                    if (activeChat && !hasMarkedAsReadRef.current) {
                        markAllAsRead();
                    }
                }
            },
            {
                root: container,
                // Trigger when sentinel is within 50px of viewport bottom
                rootMargin: '0px 0px 50px 0px',
                threshold: 0
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [activeChat, newMessagesWhileAway, markAllAsRead]);

    // Main effect for loading messages - only runs when activeChat changes
    // New messages are received via WebSocket (message:new event), no polling needed
    useEffect(() => {
        if (!activeChat) return;

        // Reset flags when chat changes
        isInitialLoadRef.current = true;
        lastMessageCountRef.current = 0;
        hasMarkedAsReadRef.current = false;
        
        // Reset scroll state when changing chats
        setIsAtBottom(true);
        setNewMessagesWhileAway(0);

        // Store initial unread count before doing anything
        const chat = chats.find((c: Chat) => c.jid === activeChat);
        const unreadCount = chat?.unreadCount || 0;
        initialUnreadCountRef.current = unreadCount;
        setInitialUnreadCount(unreadCount);

        // Mark as read immediately when opening a chat (like WhatsApp Web)
        // This updates both local state AND persists to backend
        if (unreadCount > 0) {
            markChatAsRead(activeChat);
        }

        const fetchMessages = async () => {
            setLoadingMessages(true);
            
            // Reset history state
            setIsLoadingHistory(false);
            setHasMoreHistory(true);
            setOldestLoadedMessageId(null);

            try {
                // First, try to get enhanced history
                console.log(`Fetching enhanced history for ${activeChat}`);
                const historyResponse = await chatApi.getChatHistory(activeChat, 100, undefined, true);
                
                if (historyResponse.data.success && historyResponse.data.data.length > 0) {
                    const newMessages = historyResponse.data.data || [];
                    setMessages(activeChat, newMessages);
                    
                    // Update history state
                    setHasMoreHistory(historyResponse.data.hasMore || false);
                    if (newMessages.length > 0) {
                        setOldestLoadedMessageId(newMessages[0].id);
                    }
                    
                    console.log(`Loaded ${newMessages.length} messages from enhanced history for ${activeChat}`);
                } else {
                    // Fallback to regular messages
                    console.log(`No enhanced history, falling back to regular messages for ${activeChat}`);
                    const response = await chatApi.getMessages(activeChat, 100);
                    
                    if (response.data.success) {
                        const newMessages = response.data.data || [];
                        setMessages(activeChat, newMessages);
                        
                        // No history available from API
                        setHasMoreHistory(false);
                    }
                }

                // Mark messages as read on backend after loading
                if (initialUnreadCountRef.current > 0 && !hasMarkedAsReadRef.current) {
                    hasMarkedAsReadRef.current = true;
                    try {
                        await chatApi.markAsRead(activeChat);
                    } catch (error) {
                        console.error('Failed to mark messages as read:', error);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch messages:', error);
                
                // Reset history state on error
                setHasMoreHistory(false);
                setIsLoadingHistory(false);
            } finally {
                setLoadingMessages(false);
            }
        };

        fetchMessages();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeChat]); // Only re-run when activeChat changes

    // Scroll to unread separator or end on initial load, and handle new messages via WebSocket
    useEffect(() => {
        const currentCount = chatMessages.length;
        const prevCount = lastMessageCountRef.current;
        const container = messagesContainerRef.current;
        const newMessageCount = currentCount - prevCount;

        if (isInitialLoadRef.current && currentCount > 0) {
            // Initial load: scroll to unread separator if exists, otherwise to end
            setTimeout(() => {
                if (unreadSeparatorRef.current && initialUnreadCount > 0) {
                    unreadSeparatorRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
                } else {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
                }
                // Update isNearBottomRef after initial scroll
                if (container) {
                    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
                    isNearBottomRef.current = distanceFromBottom < 150;
                    setIsAtBottom(distanceFromBottom < 150);
                }
            }, 100);
            isInitialLoadRef.current = false;
        } else if (newMessageCount > 0 && prevCount > 0) {
            // New message arrived via WebSocket
            if (isAtBottom || isNearBottomRef.current) {
                // User is at bottom: auto-scroll and mark as read
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                
                // Mark as read since user is viewing new messages
                if (activeChat && !hasMarkedAsReadRef.current) {
                    markChatAsRead(activeChat);
                }
            } else {
                // User is scrolled up: increment counter, do NOT mark as read
                setNewMessagesWhileAway(prev => prev + newMessageCount);
            }
        }

        lastMessageCountRef.current = currentCount;
    }, [chatMessages.length, initialUnreadCount, isAtBottom, activeChat, markChatAsRead]);

    if (!activeChat) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 dark:bg-[#222e35] transition-colors">
                <div className="text-center max-w-md">
                    <div className="w-[320px] h-[188px] mx-auto mb-8">
                        <img 
                            src="https://web.whatsapp.com/img/intro-connection-hq-light_9466a20e6d2921a21ac7ab82419be157.jpg" 
                            alt="WhatsApp"
                            className="w-full h-full object-contain opacity-90 dark:opacity-70"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    </div>
                    <h2 className="text-[32px] font-light text-gray-800 dark:text-[#e9edef] mb-4">
                        WhatsApp Bot Web
                    </h2>
                    <p className="text-gray-500 dark:text-[#8696a0] text-sm leading-relaxed">
                        Envía y recibe mensajes sin necesidad de mantener tu teléfono conectado.
                        <br />
                        Selecciona un chat para comenzar.
                    </p>
                </div>
            </div>
        );
    }

    // Use shared utility for consistent naming across the app
    const chatName = currentChat ? getChatTitle(currentChat) : `+${activeChat.split('@')[0]}`;
    const isGroup = currentChat ? isGroupChat(currentChat) : activeChat.includes('@g.us');
    const isBotActive = currentChat?.botActive || false;

    const handleToggleBot = async () => {
        try {
            const newStatus = !isBotActive;
            const response = await chatApi.toggleBot(activeChat, newStatus);
            if (response.data.success) {
                setChatBotActive(activeChat, newStatus);
            }
        } catch (error) {
            console.error('Failed to toggle bot:', error);
        }
    };

    // Search functionality
    const handleSearchToggle = () => {
        setIsSearchOpen(!isSearchOpen);
        if (!isSearchOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        } else {
            setSearchQuery('');
            setSearchResults([]);
            setCurrentSearchIndex(0);
        }
    };

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            setCurrentSearchIndex(0);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const results: number[] = [];
        
        chatMessages.forEach((msg: Message, index: number) => {
            const body = msg.body?.toLowerCase() || '';
            if (body.includes(lowerQuery)) {
                results.push(index);
            }
        });

        setSearchResults(results);
        setCurrentSearchIndex(results.length > 0 ? 0 : -1);
        
        // Scroll to first result
        if (results.length > 0) {
            scrollToMessage(results[0]);
        }
    };

    const scrollToMessage = (index: number) => {
        const messageElements = messagesContainerRef.current?.querySelectorAll('[data-message-index]');
        if (messageElements && messageElements[index]) {
            messageElements[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const navigateSearch = (direction: 'prev' | 'next') => {
        if (searchResults.length === 0) return;
        
        let newIndex = currentSearchIndex;
        if (direction === 'next') {
            newIndex = (currentSearchIndex + 1) % searchResults.length;
        } else {
            newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
        }
        
        setCurrentSearchIndex(newIndex);
        scrollToMessage(searchResults[newIndex]);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-[#0b141a] transition-colors">
            {/* Header - WhatsApp Web style */}
            <div className="h-[59px] bg-gray-100 dark:bg-[#202c33] flex items-center px-4 justify-between flex-shrink-0 transition-colors">
                <div className="flex items-center gap-3">
                    {/* Back button on mobile */}
                    {showBackButton && (
                        <button
                            onClick={onBack}
                            className="p-2 text-[#aebac1] hover:bg-[#374248] rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-gray-300 dark:bg-[#6b7b8a] cursor-pointer">
                        {currentChat?.profilePicUrl ? (
                            <img 
                                src={currentChat.profilePicUrl} 
                                alt={chatName} 
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            isGroup
                                ? <Users className="w-5 h-5 text-gray-500 dark:text-[#cfd8dc]" />
                                : <User className="w-5 h-5 text-gray-500 dark:text-[#cfd8dc]" />
                        )}
                    </div>
                    {/* Name and status */}
                    <div className="cursor-pointer">
                        <h2 className="text-gray-800 dark:text-[#e9edef] font-normal text-[16px] leading-tight">{chatName}</h2>
                        <p className="text-gray-500 dark:text-[#8696a0] text-[13px] truncate max-w-[200px] md:max-w-[400px]">
                            {isGroup ? 'Grupo' : getActivityStatus(currentChat?.lastMessageTime)}
                        </p>
                    </div>
                </div>

                {/* Header actions */}
                <div className="flex items-center gap-1">
                    {/* Bot toggle */}
                    <button
                        onClick={handleToggleBot}
                        title={isBotActive ? 'Bot activo - Click para desactivar' : 'Bot inactivo - Click para activar'}
                        className={clsx(
                            'p-2 rounded-full transition-colors',
                            isBotActive 
                                ? 'text-[#00a884] hover:bg-gray-200 dark:hover:bg-[#374248]' 
                                : 'text-gray-400 dark:text-[#8696a0] hover:bg-gray-200 dark:hover:bg-[#374248]'
                        )}
                    >
                        {isBotActive ? <Bot className="w-5 h-5" /> : <BotOff className="w-5 h-5" />}
                    </button>

                    {/* Chat settings */}
                    <button
                        onClick={() => setShowChatSettings(true)}
                        title="Configuración del contacto"
                        className="p-2 text-gray-500 dark:text-[#aebac1] hover:bg-gray-200 dark:hover:bg-[#374248] rounded-full transition-colors"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    
                    {/* Search in chat */}
                    <button 
                        onClick={handleSearchToggle}
                        title="Buscar en el chat"
                        className={clsx(
                            "p-2 rounded-full transition-colors",
                            isSearchOpen 
                                ? "text-[#00a884] bg-gray-200 dark:bg-[#374248]"
                                : "text-gray-500 dark:text-[#aebac1] hover:bg-gray-200 dark:hover:bg-[#374248]"
                        )}
                    >
                        <Search className="w-5 h-5" />
                    </button>
                    
                    {/* More options */}
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 text-gray-500 dark:text-[#aebac1] hover:bg-gray-200 dark:hover:bg-[#374248] rounded-full transition-colors"
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Search bar */}
            {isSearchOpen && (
                <div className="h-[52px] bg-gray-100 dark:bg-[#202c33] flex items-center px-4 gap-3 border-b border-gray-200 dark:border-[#222d34] transition-colors">
                    <div className="flex-1 relative">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Buscar mensajes..."
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#2a3942] text-gray-800 dark:text-[#d1d7db] placeholder-gray-400 dark:placeholder-[#8696a0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] transition-colors"
                        />
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#8696a0]" />
                    </div>
                    
                    {searchResults.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-[#8696a0]">
                                {currentSearchIndex + 1} de {searchResults.length}
                            </span>
                            <button
                                onClick={() => navigateSearch('prev')}
                                className="p-1.5 text-gray-500 dark:text-[#aebac1] hover:bg-gray-200 dark:hover:bg-[#374248] rounded transition-colors"
                                title="Anterior"
                            >
                                <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => navigateSearch('next')}
                                className="p-1.5 text-gray-500 dark:text-[#aebac1] hover:bg-gray-200 dark:hover:bg-[#374248] rounded transition-colors"
                                title="Siguiente"
                            >
                                <ChevronDown className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    
                    {searchQuery && searchResults.length === 0 && (
                        <span className="text-sm text-gray-500 dark:text-[#8696a0]">
                            Sin resultados
                        </span>
                    )}
                    
                    <button
                        onClick={handleSearchToggle}
                        className="p-1.5 text-gray-500 dark:text-[#aebac1] hover:bg-gray-200 dark:hover:bg-[#374248] rounded transition-colors"
                        title="Cerrar búsqueda"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Messages area wrapper with scroll to bottom button */}
            <div className="flex-1 relative overflow-hidden">
                {/* Messages area with WhatsApp background pattern */}
                <div
                    ref={messagesContainerRef}
                    className="h-full overflow-y-auto px-[5%] md:px-[10%] lg:px-[15%] py-4 bg-gray-50 dark:bg-[#0b141a] transition-colors"
                >
                    {isLoadingMessages ? (
                        <div className="flex items-center justify-center h-full">
                            <LoadingSpinner size="lg" />
                        </div>
                    ) : chatMessages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500 dark:text-[#8696a0] bg-gray-200 dark:bg-[#182229] px-4 py-2 rounded-lg text-sm">
                                No hay mensajes en este chat
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* History loading indicator */}
                            {isLoadingHistory && (
                                <div className="flex items-center justify-center py-4">
                                    <div className="flex items-center space-x-2 text-gray-500 dark:text-[#8696a0] bg-gray-200 dark:bg-[#182229] px-4 py-2 rounded-lg">
                                        <LoadingSpinner size="sm" />
                                        <span className="text-sm">Cargando historial...</span>
                                    </div>
                                </div>
                            )}
                            
                            {/* No more history indicator */}
                            {!hasMoreHistory && !isLoadingHistory && chatMessages.length > 0 && (
                                <div className="flex items-center justify-center py-2">
                                    <p className="text-gray-400 dark:text-[#667785] text-xs bg-gray-100 dark:bg-[#1a242a] px-3 py-1 rounded-full">
                                        Inicio de la conversación
                                    </p>
                                </div>
                            )}
                            
                            {chatMessages.map((message: Message, index: number) => {
                                const showSeparator = index === unreadStartIndex && initialUnreadCount > 0;
                                const isSearchMatch = searchResults.includes(index);
                                const isCurrentSearchResult = isSearchMatch && searchResults[currentSearchIndex] === index;

                                return (
                                    <div 
                                        key={`${message.id}-${index}`}
                                        data-message-index={index}
                                        className={clsx(
                                            'transition-all duration-300',
                                            isCurrentSearchResult && 'bg-yellow-100/50 dark:bg-yellow-900/30 rounded-lg -mx-2 px-2 py-1'
                                        )}
                                    >
                                        {/* Unread messages separator - WhatsApp style pill */}
                                        {showSeparator && (
                                            <div
                                                ref={unreadSeparatorRef}
                                                className="flex items-center justify-center my-3"
                                            >
                                                <div className="px-3 py-1 bg-blue-100 dark:bg-[#182229] text-blue-600 dark:text-[#00a884] text-xs font-medium rounded-lg shadow-sm">
                                                    {initialUnreadCount} mensaje{initialUnreadCount > 1 ? 's' : ''} no leído{initialUnreadCount > 1 ? 's' : ''}
                                                </div>
                                            </div>
                                        )}
                                        <MessageBubble
                                            message={message}
                                            isGroup={isGroup}
                                            searchQuery={isSearchOpen ? searchQuery : undefined}
                                            isSearchHighlight={isSearchMatch}
                                        />
                                    </div>
                                );
                            })}
                            {/* Bottom sentinel for IntersectionObserver */}
                            <div ref={bottomSentinelRef} className="h-1" />
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Scroll to bottom button with new messages badge */}
                {(showScrollToBottom || newMessagesWhileAway > 0) && (
                    <button
                        onClick={() => {
                            scrollToBottom(true);
                            // Clear new messages indicator when clicking scroll to bottom
                            setNewMessagesWhileAway(0);
                            // Mark as read when user explicitly scrolls to bottom
                            if (activeChat) {
                                markChatAsRead(activeChat);
                            }
                        }}
                        className="absolute bottom-4 right-6 w-10 h-10 bg-[#202c33] hover:bg-[#374248] text-[#aebac1] rounded-full shadow-lg flex items-center justify-center transition-all duration-200 z-10 border border-[#374248]"
                        title={newMessagesWhileAway > 0 ? `${newMessagesWhileAway} mensaje(s) nuevo(s)` : 'Ir al final'}
                    >
                        {/* New messages badge */}
                        {newMessagesWhileAway > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#00a884] text-[#111b21] text-[10px] font-bold px-1 rounded-full flex items-center justify-center">
                                {newMessagesWhileAway > 99 ? '99+' : newMessagesWhileAway}
                            </span>
                        )}
                        <ChevronDown className="w-6 h-6" />
                    </button>
                )}
            </div>

            {/* Message Input */}
            <MessageInput chatJid={activeChat} />

            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
            />

            {/* Bot Assignment Panel */}
            <BotAssignmentPanel
                isOpen={showBotConfig}
                onClose={() => setShowBotConfig(false)}
                chatJid={activeChat}
                chatName={chatName}
                isGroup={isGroup}
            />

            {/* Per-chat Settings Modal */}
            <ChatSettingsModal
                isOpen={showChatSettings}
                onClose={() => setShowChatSettings(false)}
                chatJid={activeChat}
                chatName={chatName}
            />
        </div>
    );
};
