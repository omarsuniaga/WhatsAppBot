import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Users, Tag, ChevronDown } from 'lucide-react';
import { useStore } from '../../store';
import type { ChatFilterType, ContactGroup } from '../../types';

interface ChatFilterBarProps {
    contactGroups: ContactGroup[];
}

export const ChatFilterBar = ({ contactGroups }: ChatFilterBarProps) => {
    const { chatFilter, setChatFilter } = useStore();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

    // Calculate dropdown position when opening
    useEffect(() => {
        if (isDropdownOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 4,
                left: rect.left
            });
        }
    }, [isDropdownOpen]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(target) &&
                buttonRef.current &&
                !buttonRef.current.contains(target)
            ) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFilterClick = (type: ChatFilterType) => {
        setChatFilter({ type });
        setIsDropdownOpen(false);
    };

    const handleCategorySelect = (groupId: string) => {
        setChatFilter({ type: 'custom', customGroupId: groupId });
        setIsDropdownOpen(false);
    };

    const isActive = (type: ChatFilterType) => chatFilter.type === type;

    const baseButtonClass = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap';
    const activeClass = 'bg-whatsapp-green/10 text-whatsapp-green';
    const inactiveClass = 'bg-gray-100 text-gray-600 hover:bg-gray-200';

    const selectedGroup = contactGroups.find(g => g.id === chatFilter.customGroupId);

    return (
        <div className="px-3 py-2 border-b border-gray-100 overflow-x-auto">
            <div className="flex items-center gap-2">
                {/* All filter */}
                <button
                    onClick={() => handleFilterClick('all')}
                    className={`${baseButtonClass} ${isActive('all') ? activeClass : inactiveClass}`}
                >
                    Todos
                </button>

                {/* Unread filter */}
                <button
                    onClick={() => handleFilterClick('unread')}
                    className={`${baseButtonClass} ${isActive('unread') ? activeClass : inactiveClass}`}
                >
                    <MessageCircle className="w-3.5 h-3.5" />
                    No leídos
                </button>

                {/* Groups filter */}
                <button
                    onClick={() => handleFilterClick('groups')}
                    className={`${baseButtonClass} ${isActive('groups') ? activeClass : inactiveClass}`}
                >
                    <Users className="w-3.5 h-3.5" />
                    Grupos
                </button>

                {/* Categories dropdown */}
                <button
                    ref={buttonRef}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`${baseButtonClass} ${isActive('custom') ? activeClass : inactiveClass}`}
                >
                    <Tag className="w-3.5 h-3.5" />
                    {selectedGroup ? selectedGroup.name : 'Categorías'}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown rendered as portal */}
                {isDropdownOpen && createPortal(
                    <div
                        ref={dropdownRef}
                        className="fixed w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[9999]"
                        style={{
                            top: dropdownPosition.top,
                            left: dropdownPosition.left
                        }}
                    >
                        {contactGroups.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-500">
                                No hay categorías
                            </div>
                        ) : (
                            contactGroups.map((group) => (
                                <button
                                    key={group.id}
                                    onClick={() => handleCategorySelect(group.id)}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center gap-2 ${
                                        chatFilter.customGroupId === group.id ? 'bg-whatsapp-green/10 text-whatsapp-green' : 'text-gray-700'
                                    }`}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: group.color }}
                                    />
                                    <span className="truncate">{group.name}</span>
                                    <span className="text-gray-400 ml-auto">
                                        {group.contacts.length}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>,
                    document.body
                )}
            </div>
        </div>
    );
};
