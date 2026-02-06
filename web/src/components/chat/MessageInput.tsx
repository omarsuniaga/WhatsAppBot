import { useState, useRef, useCallback } from 'react';
import {
    Send, Smile, Paperclip, Image, MapPin, User, Loader2,
    Mic, FileText, Sticker, Bold, Italic, Underline,
    MoreHorizontal, X
} from 'lucide-react';
import { messageApi } from '../../api/client';
import { useSocket } from '../../hooks/useSocket';
import { useStore } from '../../store';
import type { Message } from '../../types';
import { LocationModal } from './modals/LocationModal';
import { ContactModal } from './modals/ContactModal';
import { StickerModal } from './modals/StickerModal';

interface MessageInputProps {
    chatJid: string;
}

export const MessageInput = ({ chatJid }: MessageInputProps) => {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showFormattingMenu, setShowFormattingMenu] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const { startTyping, stopTyping } = useSocket();
    const { addMessage, updateMessageStatus } = useStore();
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recordingIntervalRef = useRef<ReturnType<typeof setInterval>>();
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setMessage(e.target.value);

        // Typing indicator
        startTyping(chatJid);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            stopTyping(chatJid);
        }, 1000);
    }, [chatJid, startTyping, stopTyping]);

    const handleSend = useCallback(async () => {
        if (!message.trim() || isSending) return;

        const messageText = message.trim();
        setIsSending(true);
        setMessage('');
        stopTyping(chatJid);

        // Optimistic update
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: Message = {
            id: tempId,
            from: chatJid,
            body: messageText,
            type: 'text',
            timestamp: Date.now() / 1000,
            fromMe: true,
            status: 'pending'
        };

        addMessage(chatJid, optimisticMessage);

        try {
            await messageApi.sendText(chatJid, messageText);
        } catch (error) {
            console.error('Failed to send message:', error);
            updateMessageStatus(chatJid, tempId, 'error');
        } finally {
            setIsSending(false);
            inputRef.current?.focus();
        }
    }, [message, isSending, chatJid, stopTyping, addMessage]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const handleSendMedia = useCallback(async (type: 'image' | 'video' | 'document' | 'audio' | 'location' | 'contact' | 'sticker') => {
        setShowAttachMenu(false);

        if (type === 'image' || type === 'video' || type === 'document' || type === 'audio') {
            // Trigger file input
            fileInputRef.current?.click();
            return;
        }

        if (type === 'location' || type === 'contact' || type === 'sticker') {
            setActiveModal(type);
        }
    }, []);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsSending(true);

        try {
            const fileType = file.type.startsWith('image/') ? 'image' :
                file.type.startsWith('video/') ? 'video' :
                    file.type.startsWith('audio/') ? 'audio' : 'document';

            if (fileType === 'image' || fileType === 'video') {
                await messageApi.sendMedia(chatJid, file, file.name);
            } else if (fileType === 'audio') {
                await messageApi.sendAudio(chatJid, file);
            } else {
                await messageApi.sendFile(chatJid, file);
            }

            // Note: Optimistic update with blob URL could be handled here if we wanted to show preview
            // But for now we rely on the backend response/socket event
        } catch (error) {
            console.error('Failed to send file:', error);
            alert('Error al enviar archivo');
        } finally {
            setIsSending(false);
            // Clear file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [chatJid]);

    const handleStartRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });

                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());

                try {
                    await messageApi.sendAudio(chatJid, audioFile);
                } catch (error) {
                    console.error('Failed to send audio:', error);
                    alert('Error al enviar audio');
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('No se pudo acceder al micrófono. Por favor verifica los permisos.');
        }
    }, [chatJid]);

    const handleStopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setRecordingTime(0);

            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
        }
    }, [isRecording]);

    const handleFormatText = useCallback((format: 'bold' | 'italic' | 'underline') => {
        const textarea = inputRef.current as any;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = message.substring(start, end);

        let formattedText = '';
        switch (format) {
            case 'bold':
                formattedText = `*${selectedText}*`;
                break;
            case 'italic':
                formattedText = `_${selectedText}_`;
                break;
            case 'underline':
                formattedText = `~${selectedText}~`;
                break;
        }

        const newMessage = message.substring(0, start) + formattedText + message.substring(end);
        setMessage(newMessage);
        setShowFormattingMenu(false);

        // Restore cursor position
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + 1, end + 1);
        }, 0);
    }, [message]);

    const insertEmoji = useCallback((emoji: string) => {
        const textarea = inputRef.current as any;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newMessage = message.substring(0, start) + emoji + message.substring(end);
        setMessage(newMessage);
        setShowEmojiPicker(false);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + emoji.length, start + emoji.length);
        }, 0);
    }, [message]);

    // State for modals
    const [activeModal, setActiveModal] = useState<'location' | 'contact' | 'sticker' | null>(null);

    return (
        <>
            {/* Modal Components */}
            <LocationModal
                isOpen={activeModal === 'location'}
                onClose={() => setActiveModal(null)}
                onSend={async (lat, lon) => {
                    await messageApi.sendLocation(chatJid, lat, lon);
                }}
            />

            <ContactModal
                isOpen={activeModal === 'contact'}
                onClose={() => setActiveModal(null)}
                onSend={async (number, name) => {
                    await messageApi.sendContact(chatJid, number, name);
                }}
            />

            <StickerModal
                isOpen={activeModal === 'sticker'}
                onClose={() => setActiveModal(null)}
                onSend={async (url) => {
                    await messageApi.sendSticker(chatJid, url);
                }}
            />

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={handleFileSelect}
                className="hidden"
            />

            <div className="bg-[#202c33] px-4 py-2 flex-shrink-0">
                {/* Recording indicator */}
                {isRecording && (
                    <div className="mb-2 flex items-center justify-center gap-2 bg-[#182229] rounded-lg p-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-red-400 font-medium">
                            Grabando audio... {Math.floor(recordingTime)}s
                        </span>
                        <button
                            onClick={handleStopRecording}
                            className="px-3 py-1 bg-red-500 text-white text-sm rounded-full hover:bg-red-600 transition-colors"
                        >
                            Detener
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    {/* Emoji button */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="p-2 text-[#8696a0] hover:text-[#e9edef] transition-colors"
                            title="Emojis"
                        >
                            <Smile className="w-6 h-6" />
                        </button>

                        {/* Emoji picker */}
                        {showEmojiPicker && (
                            <div className="absolute bottom-12 left-0 bg-[#233138] rounded-lg shadow-lg border border-[#374248] p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-[#e9edef]">Emojis</span>
                                    <button
                                        onClick={() => setShowEmojiPicker(false)}
                                        className="p-1 hover:bg-[#374248] rounded text-[#8696a0]"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-8 gap-1">
                                    {['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😴', '😪', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'].map((emoji) => (
                                        <button
                                            key={emoji}
                                            onClick={() => insertEmoji(emoji)}
                                            className="p-2 hover:bg-[#374248] rounded text-lg"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Attachment menu */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowAttachMenu(!showAttachMenu)}
                            className="p-2 text-[#8696a0] hover:text-[#e9edef] transition-colors"
                            title="Adjuntar"
                        >
                            <Paperclip className="w-6 h-6" />
                        </button>

                        {showAttachMenu && (
                            <div className="absolute bottom-12 left-0 bg-[#233138] rounded-lg shadow-lg border border-[#374248] py-2 min-w-[180px] z-50">
                                <button
                                    onClick={() => handleSendMedia('image')}
                                    className="w-full px-4 py-2 flex items-center gap-2 hover:bg-[#374248] text-sm text-[#e9edef]"
                                >
                                    <Image className="w-4 h-4 text-purple-400" />
                                    Imagen o Video
                                </button>
                                <button
                                    onClick={() => handleSendMedia('document')}
                                    className="w-full px-4 py-2 flex items-center gap-2 hover:bg-[#374248] text-sm text-[#e9edef]"
                                >
                                    <FileText className="w-4 h-4 text-blue-400" />
                                    Documento
                                </button>
                                <button
                                    onClick={() => handleSendMedia('audio')}
                                    className="w-full px-4 py-2 flex items-center gap-2 hover:bg-[#374248] text-sm text-[#e9edef]"
                                >
                                    <Mic className="w-4 h-4 text-green-400" />
                                    Audio
                                </button>
                                <button
                                    onClick={() => setActiveModal('sticker')}
                                    className="w-full px-4 py-2 flex items-center gap-2 hover:bg-[#374248] text-sm text-[#e9edef]"
                                >
                                    <Sticker className="w-4 h-4 text-orange-400" />
                                    Sticker
                                </button>
                                <button
                                    onClick={() => setActiveModal('location')}
                                    className="w-full px-4 py-2 flex items-center gap-2 hover:bg-[#374248] text-sm text-[#e9edef]"
                                >
                                    <MapPin className="w-4 h-4 text-red-400" />
                                    Ubicación
                                </button>
                                <button
                                    onClick={() => setActiveModal('contact')}
                                    className="w-full px-4 py-2 flex items-center gap-2 hover:bg-[#374248] text-sm text-[#e9edef]"
                                >
                                    <User className="w-4 h-4 text-indigo-400" />
                                    Contacto
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Text input with formatting */}
                    <div className="flex-1 relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={message}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe un mensaje"
                            disabled={isSending || isRecording}
                            className="w-full px-4 py-2.5 rounded-lg bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] border-none focus:outline-none disabled:opacity-50"
                        />

                        {/* Formatting menu */}
                        {message && (
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setShowFormattingMenu(!showFormattingMenu)}
                                    className="p-1 hover:bg-[#374248] rounded transition-colors"
                                    title="Formato"
                                >
                                    <MoreHorizontal className="w-4 h-4 text-[#8696a0]" />
                                </button>

                                {showFormattingMenu && (
                                    <div className="absolute bottom-8 right-0 bg-[#233138] rounded-lg shadow-lg border border-[#374248] py-1 flex gap-1">
                                        <button
                                            onClick={() => handleFormatText('bold')}
                                            className="p-1 hover:bg-[#374248] rounded transition-colors"
                                            title="Negrita"
                                        >
                                            <Bold className="w-4 h-4 text-[#e9edef]" />
                                        </button>
                                        <button
                                            onClick={() => handleFormatText('italic')}
                                            className="p-1 hover:bg-[#374248] rounded transition-colors"
                                            title="Cursiva"
                                        >
                                            <Italic className="w-4 h-4 text-[#e9edef]" />
                                        </button>
                                        <button
                                            onClick={() => handleFormatText('underline')}
                                            className="p-1 hover:bg-[#374248] rounded transition-colors"
                                            title="Subrayado"
                                        >
                                            <Underline className="w-4 h-4 text-[#e9edef]" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Send/Mic button */}
                    {message.trim() ? (
                        <button
                            onClick={handleSend}
                            disabled={isSending}
                            className="p-2 text-[#8696a0] hover:text-[#00a884] disabled:opacity-50 transition-colors"
                            title="Enviar"
                        >
                            {isSending ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <Send className="w-6 h-6" />
                            )}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onMouseDown={handleStartRecording}
                            onMouseUp={handleStopRecording}
                            onTouchStart={handleStartRecording}
                            onTouchEnd={handleStopRecording}
                            className="p-2 text-[#8696a0] hover:text-[#e9edef] transition-colors"
                            title="Grabar audio"
                        >
                            <Mic className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};
