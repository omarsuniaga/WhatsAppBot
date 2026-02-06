import { clsx } from 'clsx';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, User, Bot, BotOff } from 'lucide-react';
import type { Chat } from '../../types';
import { chatApi } from '../../api/client';
import { useStore } from '../../store';
import { getChatTitle, getSenderDisplayName, isGroupChat } from '../../utils/chatTitle';

interface ChatListItemProps {
    chat: Chat;
    isActive: boolean;
    onClick: () => void;
}

// CRITICAL: Active chat should NEVER show unread badge
// This prevents visual inconsistency when user is viewing the chat

export const ChatListItem = ({ chat, isActive, onClick }: ChatListItemProps) => {
    const { setChatBotActive } = useStore();

    const formatTime = (timestamp?: number) => {
        if (!timestamp) return '';
        try {
            const date = new Date(timestamp * 1000);
            if (isToday(date)) {
                return format(date, 'h:mm a', { locale: es });
            } else if (isYesterday(date)) {
                return 'Ayer';
            }
            return format(date, 'd/M/yyyy', { locale: es });
        } catch {
            return '';
        }
    };

    // Use shared utility for consistent naming across the app
    const chatTitle = getChatTitle(chat);
    const isGroup = isGroupChat(chat);

    const handleBotToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const newStatus = !chat.botActive;
        try {
            await chatApi.toggleBot(chat.jid, newStatus);
            setChatBotActive(chat.jid, newStatus);
        } catch (error) {
            console.error('Error toggling bot:', error);
        }
    };

    return (
        <div
            onClick={onClick}
            className={clsx(
                'flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors',
                isActive
                    ? 'bg-blue-50 dark:bg-[#2a3942]'
                    : 'hover:bg-gray-50 dark:hover:bg-[#202c33]'
            )}
        >
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-gray-300 dark:bg-[#6b7b8a]">
                {chat.profilePicUrl ? (
                    <img 
                        src={chat.profilePicUrl} 
                        alt={chatTitle} 
                        className="w-full h-full object-cover"
                    />
                ) : (
                    isGroup
                        ? <Users className="w-6 h-6 text-gray-500 dark:text-[#cfd8dc]" />
                        : <User className="w-6 h-6 text-gray-500 dark:text-[#cfd8dc]" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 border-b border-gray-200 dark:border-[#222d34] py-1">
                <div className="flex items-center justify-between">
                    <h3 className="font-normal text-gray-800 dark:text-[#e9edef] truncate text-[16px]">
                        {chatTitle}
                    </h3>
                    <span className={clsx(
                        'text-xs flex-shrink-0 ml-2',
                        chat.unreadCount > 0 ? 'text-[#00a884]' : 'text-gray-500 dark:text-[#8696a0]'
                    )}>
                        {formatTime(chat.lastMessageTime)}
                    </span>
                </div>

                <div className="flex items-center justify-between mt-0.5">
                    <div className="min-w-0 flex-1 flex items-center gap-1">
                        {/* Bot status indicator */}
                        {chat.botActive !== undefined && (
                            <button
                                onClick={handleBotToggle}
                                className={clsx(
                                    'flex-shrink-0 transition-colors',
                                    chat.botActive ? 'text-[#00a884]' : 'text-gray-400 dark:text-[#8696a0]'
                                )}
                                title={chat.botActive ? 'Bot activo' : 'Bot inactivo'}
                            >
                                {chat.botActive ? (
                                    <Bot className="w-4 h-4" />
                                ) : (
                                    <BotOff className="w-4 h-4" />
                                )}
                            </button>
                        )}
                        
                        {/* Last message preview */}
                        <p className="text-sm text-gray-500 dark:text-[#8696a0] truncate">
                            {chat.lastMessageSender && isGroup ? (
                                <>
                                    <span className="text-gray-500 dark:text-[#8696a0]">
                                        {getSenderDisplayName(chat.lastMessageSender)}:
                                    </span>{' '}
                                    {chat.lastMessage || 'Sin mensajes'}
                                </>
                            ) : (
                                chat.lastMessage || 'Sin mensajes'
                            )}
                        </p>
                    </div>
                    
                    {/* Right side icons */}
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {/* Unread badge - NEVER show for active chat */}
                        {!isActive && chat.unreadCount > 0 && (
                            <span className="min-w-[20px] h-5 bg-[#00a884] text-[#111b21] text-xs font-medium px-1.5 rounded-full flex items-center justify-center">
                                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
