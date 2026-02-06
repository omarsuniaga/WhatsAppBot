import { clsx } from 'clsx';
import { format } from 'date-fns';
import { Image, FileText, Mic, MapPin, Contact, User } from 'lucide-react';
import type { Message } from '../../types';
import { MessageStatus } from '../common/MessageStatus';

interface MessageBubbleProps {
    message: Message;
    isGroup?: boolean;
    searchQuery?: string;
    isSearchHighlight?: boolean;
}

// Generate consistent color from string
const stringToColor = (str: string): string => {
    const colors = [
        'text-red-600',
        'text-blue-600',
        'text-green-600',
        'text-purple-600',
        'text-orange-600',
        'text-pink-600',
        'text-teal-600',
        'text-indigo-600',
        'text-cyan-600',
        'text-amber-600'
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export const MessageBubble = ({ message, isGroup = false, searchQuery, isSearchHighlight }: MessageBubbleProps) => {
    const formatTime = (timestamp: number) => {
        try {
            const date = new Date(timestamp * 1000);
            if (isNaN(date.getTime())) {
                return format(new Date(timestamp), 'HH:mm');
            }
            return format(date, 'HH:mm');
        } catch {
            return '';
        }
    };

    // Status icon is now handled by MessageStatus component

    const getTypeIcon = () => {
        switch (message.type) {
            case 'image':
                return <Image className="w-4 h-4 mr-1" />;
            case 'document':
                return <FileText className="w-4 h-4 mr-1" />;
            case 'audio':
                return <Mic className="w-4 h-4 mr-1" />;
            case 'location':
                return <MapPin className="w-4 h-4 mr-1" />;
            case 'contact':
                return <Contact className="w-4 h-4 mr-1" />;
            default:
                return null;
        }
    };

    const getMessageContent = () => {
        if (message.type === 'text' || message.body) {
            return message.body;
        }

        const typeLabels: Record<string, string> = {
            image: 'Imagen',
            video: 'Video',
            audio: 'Nota de voz',
            document: 'Documento',
            location: 'Ubicacion',
            contact: 'Contacto',
            sticker: 'Sticker',
            poll: 'Encuesta'
        };

        return typeLabels[message.type] || 'Mensaje';
    };

    // Highlight search matches in text
    const highlightText = (text: string) => {
        if (!searchQuery || !isSearchHighlight || !text) return text;
        
        const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
        
        return parts.map((part, i) => 
            part.toLowerCase() === searchQuery.toLowerCase() ? (
                <mark key={i} className="bg-yellow-300 dark:bg-yellow-500 text-gray-900 dark:text-gray-900 rounded px-0.5">
                    {part}
                </mark>
            ) : part
        );
    };

    // Determine sender name for display
    const senderName = message.senderName || message.pushName || message.senderJid?.split('@')[0];
    const senderColor = senderName ? stringToColor(senderName) : 'text-teal-600';
    const showSenderInfo = isGroup && !message.fromMe && senderName;

    return (
        <div className={clsx(
            'flex mb-1',
            message.fromMe ? 'justify-end' : 'justify-start'
        )}>
            {/* Sender profile picture for group messages */}
            {showSenderInfo && (
                <div className="flex-shrink-0 mr-2 mt-1">
                    {message.senderProfilePic ? (
                        <img
                            src={message.senderProfilePic}
                            alt={senderName}
                            className="w-8 h-8 rounded-full object-cover"
                            onError={(e) => {
                                // Fallback to default avatar on error
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                            }}
                        />
                    ) : null}
                    {!message.senderProfilePic && (
                        <div className="w-8 h-8 rounded-full bg-[#6b7b8a] flex items-center justify-center">
                            <User className="w-4 h-4 text-[#cfd8dc]" />
                        </div>
                    )}
                </div>
            )}

            <div className={clsx(
                'max-w-[70%] rounded-lg px-3 py-2 shadow-sm inline-block',
                message.fromMe
                    ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                    : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
            )}>
                {/* Sender name for group messages */}
                {showSenderInfo && (
                    <p className={clsx('text-xs font-semibold mb-1', senderColor)}>
                        {senderName}
                    </p>
                )}

                {/* Message content */}
                <div className="flex items-start">
                    {message.type !== 'text' && getTypeIcon()}
                    <p className="text-sm whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {highlightText(getMessageContent())}
                    </p>
                </div>

                {/* Time and status */}
                <div className="flex items-center justify-end gap-1 mt-1 select-none">
                    <span className={clsx(
                        'text-[11px]',
                        message.fromMe ? 'text-[#ffffffb3]' : 'text-[#8696a0]'
                    )}>
                        {formatTime(message.timestamp)}
                    </span>
                    {message.fromMe && <MessageStatus message={message} className="ml-0.5" />}
                </div>
            </div>
        </div>
    );
};
