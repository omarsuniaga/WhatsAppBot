import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ConnectionStatus, Message, Chat, ChatFilter, ContactGroup } from '../types';

// Local read state tracking - survives refreshes
// Key: jid, Value: Unix timestamp (seconds) of last read
type ReadStateMap = Record<string, number>;

interface AppState {
    // Connection
    connectionStatus: ConnectionStatus;
    qrCode: string | null;
    pairingCode: string | null;

    // Chats
    chats: Chat[];
    activeChat: string | null;

    // Messages
    messages: Record<string, Message[]>;

    // Read state - SINGLE SOURCE OF TRUTH for unread badges
    // Stores lastReadTimestamp per chat to prevent badges from reappearing
    localReadState: ReadStateMap;

    // Loading states
    isLoadingChats: boolean;
    isLoadingMessages: boolean;

    // Filter state
    chatFilter: ChatFilter;
    contactGroups: ContactGroup[];
    isLoadingContactGroups: boolean;

    // Actions
    setConnectionStatus: (status: ConnectionStatus) => void;
    setQRCode: (qr: string | null) => void;
    setPairingCode: (code: string | null) => void;
    setChats: (chats: Chat[]) => void;
    mergeChats: (chats: Chat[]) => void;
    setActiveChat: (jid: string | null) => void;
    addMessage: (jid: string, message: Message) => void;
    setMessages: (jid: string, messages: Message[]) => void;
    updateMessageStatus: (jid: string, messageId: string, status: Message['status']) => void;
    setLoadingChats: (loading: boolean) => void;
    setLoadingMessages: (loading: boolean) => void;
    updateChatWithNewMessage: (jid: string, message: Message) => void;
    setChatBotActive: (jid: string, active: boolean) => void;
    setChatFilter: (filter: ChatFilter) => void;
    setContactGroups: (groups: ContactGroup[]) => void;
    setLoadingContactGroups: (loading: boolean) => void;
    markChatAsRead: (jid: string, timestamp?: number) => void;
    updateUnreadCount: (jid: string, count: number) => void;
    updateChatFromServer: (data: { jid: string; stableKey?: string; displayName?: string; unreadCount?: number; lastMessage?: string; lastMessageTime?: number }) => void;
    
    // Read state helpers
    getLocalReadTimestamp: (jid: string) => number | null;
    isMessageUnread: (jid: string, messageTimestamp: number) => boolean;
}

export const useStore = create<AppState>()(
    devtools(
        (set, get) => ({
            // Initial state
            connectionStatus: 'disconnected',
            qrCode: null,
            pairingCode: null,
            chats: [],
            activeChat: null,
            messages: {},
            localReadState: {},
            isLoadingChats: false,
            isLoadingMessages: false,
            chatFilter: { type: 'all' },
            contactGroups: [],
            isLoadingContactGroups: false,

            // Actions
            setConnectionStatus: (status) => set({ connectionStatus: status }),
            setQRCode: (qr) => set({ qrCode: qr }),
            setPairingCode: (code) => set({ pairingCode: code }),
            setChats: (chats) => set({ chats }),
            
            // Merge chats with SMART read state preservation
            // This prevents unread badges from reappearing after sync
            mergeChats: (newChats) => set((state) => {
                const mergedChats = newChats.map(newChat => {
                    const localReadTimestamp = state.localReadState[newChat.jid];
                    
                    // RULE 1: Active chat ALWAYS has unreadCount = 0
                    if (state.activeChat === newChat.jid) {
                        return { ...newChat, unreadCount: 0 };
                    }
                    
                    // RULE 2: If we have a local read timestamp, use it to determine unread
                    if (localReadTimestamp) {
                        // If last message is older than our read timestamp, force 0
                        if (newChat.lastMessageTime && newChat.lastMessageTime <= localReadTimestamp) {
                            return { ...newChat, unreadCount: 0 };
                        }
                        
                        // If we read recently (within last minute), trust local state
                        const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
                        if (localReadTimestamp > oneMinuteAgo && newChat.unreadCount > 0) {
                            // Check existing chat - if it was 0, keep it 0
                            const existing = state.chats.find(c => c.jid === newChat.jid);
                            if (existing && existing.unreadCount === 0) {
                                return { ...newChat, unreadCount: 0 };
                            }
                        }
                    }
                    
                    // RULE 3: Preserve local 0 if backend reports unread
                    // (prevents resurrection of badges)
                    const existing = state.chats.find(c => c.jid === newChat.jid);
                    if (existing && existing.unreadCount === 0 && newChat.unreadCount > 0) {
                        // Only allow unread to come back if there's a genuinely new message
                        // (lastMessageTime is newer than what we had)
                        if (!existing.lastMessageTime || 
                            (newChat.lastMessageTime && newChat.lastMessageTime <= existing.lastMessageTime)) {
                            return { ...newChat, unreadCount: 0 };
                        }
                    }

                    return newChat;
                });

                return { chats: mergedChats };
            }),
            
            setActiveChat: (jid) => set({ activeChat: jid }),

            addMessage: (jid, message) => set((state) => ({
                messages: {
                    ...state.messages,
                    [jid]: [...(state.messages[jid] || []), message]
                }
            })),

            setMessages: (jid, messages) => set((state) => ({
                messages: {
                    ...state.messages,
                    [jid]: messages
                }
            })),

            updateMessageStatus: (jid, messageId, status) => set((state) => ({
                messages: {
                    ...state.messages,
                    [jid]: state.messages[jid]?.map(msg =>
                        msg.id === messageId ? { ...msg, status } : msg
                    ) || []
                }
            })),

            setLoadingChats: (loading) => set({ isLoadingChats: loading }),
            setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),

            updateChatWithNewMessage: (jid, message) => set((state) => {
                const chatIndex = state.chats.findIndex(c => c.jid === jid);
                if (chatIndex === -1) {
                    // Add new chat
                    return {
                        chats: [{
                            jid,
                            name: message.pushName || jid.split('@')[0],
                            lastMessage: message.body,
                            lastMessageTime: message.timestamp,
                            unreadCount: message.fromMe ? 0 : 1,
                            isGroup: jid.includes('@g.us')
                        }, ...state.chats]
                    };
                }

                // Update existing chat
                const updatedChats = [...state.chats];
                const chat = { ...updatedChats[chatIndex] };
                chat.lastMessage = message.body;
                chat.lastMessageTime = message.timestamp;
                if (!message.fromMe && state.activeChat !== jid) {
                    chat.unreadCount = (chat.unreadCount || 0) + 1;
                }

                // Move to top
                updatedChats.splice(chatIndex, 1);
                updatedChats.unshift(chat);

                return { chats: updatedChats };
            }),

            setChatBotActive: (jid, active) => set((state) => ({
                chats: state.chats.map(chat =>
                    chat.jid === jid ? { ...chat, botActive: active } : chat
                )
            })),

            setChatFilter: (filter) => set({ chatFilter: filter }),
            setContactGroups: (groups) => set({ contactGroups: groups }),
            setLoadingContactGroups: (loading) => set({ isLoadingContactGroups: loading }),

            // Mark chat as read - updates both chats and local read state
            markChatAsRead: (jid, timestamp) => set((state) => {
                const readTimestamp = timestamp || Math.floor(Date.now() / 1000);
                
                return {
                    // Update local read state (SINGLE SOURCE OF TRUTH)
                    localReadState: {
                        ...state.localReadState,
                        [jid]: Math.max(state.localReadState[jid] || 0, readTimestamp)
                    },
                    // Update chat unread count
                    chats: state.chats.map(chat =>
                        chat.jid === jid ? { ...chat, unreadCount: 0 } : chat
                    )
                };
            }),

            updateUnreadCount: (jid, count) => set((state) => ({
                chats: state.chats.map(chat =>
                    chat.jid === jid ? { ...chat, unreadCount: Math.max(0, count) } : chat
                )
            })),

            // Update chat from server event (chat:updated socket event)
            // This ensures real-time sync of displayName and unreadCount
            updateChatFromServer: (data) => set((state) => {
                const { jid, stableKey, displayName, unreadCount, lastMessage, lastMessageTime } = data;
                const chatIndex = state.chats.findIndex(c => c.jid === jid || c.stableKey === stableKey);
                
                if (chatIndex === -1) {
                    // Chat not found - don't add new chats here, let full refresh handle it
                    return state;
                }
                
                const updatedChats = [...state.chats];
                const chat = { ...updatedChats[chatIndex] };
                
                // Update displayName if provided
                if (displayName) {
                    chat.displayName = displayName;
                }
                
                // Update unreadCount ONLY if this is NOT the active chat
                if (typeof unreadCount === 'number' && state.activeChat !== jid) {
                    chat.unreadCount = unreadCount;
                }
                
                // Update last message info
                if (lastMessage !== undefined) {
                    chat.lastMessage = lastMessage;
                }
                if (lastMessageTime !== undefined) {
                    chat.lastMessageTime = lastMessageTime;
                }
                
                // Move to top if there's a new message
                if (lastMessageTime !== undefined) {
                    updatedChats.splice(chatIndex, 1);
                    updatedChats.unshift(chat);
                } else {
                    updatedChats[chatIndex] = chat;
                }
                
                return { chats: updatedChats };
            }),

            // Helper: get local read timestamp for a chat
            getLocalReadTimestamp: (jid) => {
                return get().localReadState[jid] || null;
            },

            // Helper: check if a message is unread based on local state
            isMessageUnread: (jid, messageTimestamp) => {
                const localReadTimestamp = get().localReadState[jid];
                if (!localReadTimestamp) return true;
                return messageTimestamp > localReadTimestamp;
            }
        }),
        { name: 'wa-bot-store' }
    )
);
