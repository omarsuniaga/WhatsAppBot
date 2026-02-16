import { useState } from 'react';
import { ChatList } from '../components/chat/ChatList';
import { ChatView } from '../components/chat/ChatView';
import { Sidebar } from '../components/common/Sidebar';
import { SettingsPanel } from '../components/settings/SettingsPanel';
import { AlertPanel } from '../components/alerts';
import { useStore } from '../store';

interface ChatPageProps {
    onOpenAdmin?: () => void;
}

/**
 * ChatPage - WhatsApp-like Chat Interface
 * 
 * Responsive layout using mobile-first approach:
 * - Mobile (< 768px): Full-width chat list, overlay chat view
 * - Tablet/Desktop (≥ 768px): Split panel layout with sidebar
 * 
 * Uses CSS media queries instead of JavaScript breakpoints for better performance
 */
export const ChatPage = ({ onOpenAdmin }: ChatPageProps) => {
    const { setActiveChat } = useStore();
    const [showChatOnMobile, setShowChatOnMobile] = useState(false);
    const [activeTab, setActiveTab] = useState<'chats' | 'calls' | 'status' | 'groups' | 'admin'>('chats');
    const [showSettings, setShowSettings] = useState(false);
    const [showAlerts, setShowAlerts] = useState(false);
    const [alertCount, setAlertCount] = useState(0);

    const handleSelectChat = (jid: string) => {
        setActiveChat(jid);
        // On mobile, show chat view when selecting
        setShowChatOnMobile(true);
    };

    const handleBackToList = () => {
        setShowChatOnMobile(false);
    };

    return (
        <div className="h-dvh flex flex-col bg-white dark:bg-[#111b21] transition-colors duration-200">
            {/* Settings Panel */}
            <SettingsPanel 
                isOpen={showSettings} 
                onClose={() => setShowSettings(false)} 
            />

            {/* Alerts Panel */}
            <AlertPanel 
                isOpen={showAlerts} 
                onClose={() => setShowAlerts(false)}
                onAlertCountChange={setAlertCount}
            />

            {/* Main layout: Responsive grid */}
            <div className="hidden md:flex flex-1 min-h-0">
                {/* Sidebar - Desktop only */}
                <aside className="hidden lg:flex flex-col flex-shrink-0">
                    <Sidebar 
                        activeTab={activeTab} 
                        onTabChange={setActiveTab}
                        onOpenAdmin={onOpenAdmin}
                        onOpenSettings={() => setShowSettings(true)}
                        onOpenAlerts={() => setShowAlerts(true)}
                        alertCount={alertCount}
                    />
                </aside>

                {/* Chat list panel - Desktop/Tablet */}
                <nav 
                    className="w-full sm:w-[clamp(300px,35%,500px)] flex-shrink-0 border-r border-[#222d34] overflow-y-auto"
                    role="complementary"
                    aria-label="Chat list"
                >
                    <ChatList onSelectChat={handleSelectChat} />
                </nav>
                
                {/* Chat view panel - Desktop/Tablet (flex-1 expands) */}
                <main 
                    className="hidden md:flex flex-1 flex-col min-w-0"
                    role="main"
                    aria-label="Chat view"
                >
                    <ChatView onBack={undefined} showBackButton={false} />
                </main>
            </div>

            {/* Mobile layout: Full-width single panel */}
            <div className="md:hidden flex-1 min-h-0 overflow-hidden">
                {/* Chat list or view - Toggle based on selection */}
                <div 
                    className={`h-full transition-all duration-200 ease-out ${
                        showChatOnMobile ? 'hidden' : 'block'
                    }`}
                >
                    <ChatList 
                        onSelectChat={handleSelectChat} 
                    />
                </div>

                {/* Chat view overlay */}
                <div 
                    className={`h-full transition-all duration-200 ease-out ${
                        showChatOnMobile ? 'block' : 'hidden'
                    }`}
                >
                    <ChatView 
                        onBack={handleBackToList}
                        showBackButton={true}
                    />
                </div>
            </div>
        </div>
    );
};
