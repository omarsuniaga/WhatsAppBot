import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import type { Message } from '../../types';

interface MessageStatusProps {
    message: Message;
    className?: string;
}

export const MessageStatus = ({ message, className = '' }: MessageStatusProps) => {
    if (!message.fromMe) {
        return null; // Don't show status for received messages
    }

    const getStatusIcon = () => {
        switch (message.status) {
            case 'pending':
                return <Clock className="w-3.5 h-3.5 text-[#ffffff99]" />;
            case 'sent':
                return <Check className="w-3.5 h-3.5 text-[#ffffff99]" />;
            case 'delivered':
                return <CheckCheck className="w-3.5 h-3.5 text-[#ffffff99]" />;
            case 'read':
                return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />;
            case 'error':
                return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
            default:
                // Fallback to ack value if status is not available
                switch (message.ack) {
                    case 0:
                        return <Clock className="w-3.5 h-3.5 text-[#ffffff99]" />;
                    case 1:
                        return <Check className="w-3.5 h-3.5 text-[#ffffff99]" />;
                    case 2:
                        return <CheckCheck className="w-3.5 h-3.5 text-[#ffffff99]" />;
                    case 3:
                        return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />;
                    case 4:
                        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
                    default:
                        // Default: show single check for sent messages without status
                        return <Check className="w-3.5 h-3.5 text-[#ffffff99]" />;
                }
        }
    };

    return (
        <div className={`flex items-center ${className}`}>
            {getStatusIcon()}
        </div>
    );
};
