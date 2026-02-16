import { clsx } from 'clsx';
import { format } from 'date-fns';
import { Image, FileText, Mic, MapPin, Contact, User, File, Download } from 'lucide-react';
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
            location: 'Ubicación',
            contact: 'Contacto',
            sticker: 'Sticker',
            poll: 'Encuesta'
        };

        const baseLabel = typeLabels[message.type] || 'Mensaje';
        
        // Add enhanced information for media messages
        if (message.isMedia && message.fileName) {
            return `${baseLabel}: ${message.fileName}`;
        }
        
        if (message.type === 'audio' && message.duration) {
            const minutes = Math.floor(message.duration / 60);
            const seconds = message.duration % 60;
            return `${baseLabel} (${minutes}:${seconds.toString().padStart(2, '0')})`;
        }
        
        if (message.type === 'location' && message.location?.name) {
            return `${baseLabel}: ${message.location.name}`;
        }
        
        if (message.type === 'contact' && message.contactInfo?.name) {
            return `${baseLabel}: ${message.contactInfo.name}`;
        }

        return baseLabel;
    };

    // Media preview component
    const MediaPreview = () => {
        if (!message.mediaUrl || !message.isMedia) return null;

        const handleDownload = () => {
            if (message.mediaUrl) {
                const link = document.createElement('a');
                link.href = message.mediaUrl;
                link.download = message.fileName || 'media';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        };

        switch (message.type) {
            case 'image':
                return (
                    <div className="mt-2 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                        <img
                            src={message.mediaUrl}
                            alt={message.body || 'Imagen'}
                            className="max-w-full h-auto rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(message.mediaUrl, '_blank')}
                        />
                        {message.hasCaption && message.body && (
                            <p className="p-2 text-sm text-gray-700 dark:text-gray-300">
                                {highlightText(message.body)}
                            </p>
                        )}
                    </div>
                );

            case 'video':
                return (
                    <div className="mt-2 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                        <video
                            src={message.mediaUrl}
                            controls
                            className="max-w-full h-auto rounded"
                            poster={message.body ? undefined : undefined}
                        />
                        {message.hasCaption && message.body && (
                            <p className="p-2 text-sm text-gray-700 dark:text-gray-300">
                                {highlightText(message.body)}
                            </p>
                        )}
                    </div>
                );

            case 'audio':
                return (
                    <div className="mt-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                        <audio
                            src={message.mediaUrl}
                            controls
                            className="w-full"
                        />
                        {message.duration && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Duración: {Math.floor(message.duration / 60)}:{(message.duration % 60).toString().padStart(2, '0')}
                            </p>
                        )}
                    </div>
                );

            case 'document':
                return (
                    <div className="mt-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center space-x-3">
                            <File className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {message.fileName || 'Documento'}
                                </p>
                                {message.fileSize && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {(message.fileSize / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={handleDownload}
                                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                                title="Descargar"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        {message.hasCaption && message.body && (
                            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                                {highlightText(message.body)}
                            </p>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    // Location preview component
    const LocationPreview = () => {
        if (!message.location) return null;

        const mapsUrl = `https://maps.google.com/?q=${message.location.lat},${message.location.lng}`;

        return (
            <div className="mt-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center space-x-3">
                    <MapPin className="w-8 h-8 text-red-500" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {message.location.name || 'Ubicación'}
                        </p>
                        <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
                        >
                            Ver en mapa
                        </a>
                    </div>
                </div>
            </div>
        );
    };

    // Contact preview component
    const ContactPreview = () => {
        if (!message.contactInfo) return null;

        return (
            <div className="mt-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center space-x-3">
                    <Contact className="w-8 h-8 text-blue-500" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {message.contactInfo.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Contacto
                        </p>
                    </div>
                </div>
            </div>
        );
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
                    <div className="flex-1">
                        {/* Text content for non-media messages or captions */}
                        {(!message.isMedia || message.hasCaption) && (
                            <p className="text-sm whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                {highlightText(getMessageContent())}
                            </p>
                        )}
                        
                        {/* Media previews */}
                        <MediaPreview />
                        
                        {/* Location preview */}
                        <LocationPreview />
                        
                        {/* Contact preview */}
                        <ContactPreview />
                    </div>
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
