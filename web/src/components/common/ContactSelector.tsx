import { useState, useRef, useEffect } from 'react';
import { Search, Users, User, X, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Contact {
  id: string;
  name: string;
  jid: string;
  isGroup: boolean;
  avatar?: string;
}

export interface ContactSelectorProps {
  contacts: Contact[];
  selectedContacts: Contact[];
  onContactSelect: (contact: Contact) => void;
  onContactRemove: (contactId: string) => void;
  loading?: boolean;
  placeholder?: string;
  className?: string;
}

export const ContactSelector = ({
  contacts,
  selectedContacts,
  onContactSelect,
  onContactRemove,
  loading = false,
  placeholder = 'Buscar contactos o grupos...',
  className
}: ContactSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter contacts based on search query
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const filtered = contacts.filter(contact =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.jid.toLowerCase().includes(searchQuery.toLowerCase())
    ).filter(contact => 
      !selectedContacts.some(selected => selected.id === contact.id)
    ).slice(0, 10);

    setSearchResults(filtered);
    setShowResults(true);
  }, [searchQuery, contacts, selectedContacts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleContactSelect = (contact: Contact) => {
    onContactSelect(contact);
    setSearchQuery('');
    setShowResults(false);
  };

  return (
    <div ref={searchRef} className={cn('relative', className)}>
      {/* Selected Contacts */}
      {selectedContacts.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800"
            >
              <div className="flex items-center gap-1">
                {contact.isGroup ? (
                  <Users className="w-3 h-3" />
                ) : (
                  <User className="w-3 h-3" />
                )}
                <span className="text-xs font-medium">{contact.name}</span>
              </div>
              <button
                onClick={() => onContactRemove(contact.id)}
                className="text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          ) : (
            <Search className="w-4 h-4 text-gray-400" />
          )}
        </div>
        
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (searchResults.length > 0) {
              setShowResults(true);
            }
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
        
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setShowResults(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {searchResults.map((contact) => (
            <button
              key={contact.id}
              onClick={() => handleContactSelect(contact)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
            >
              <div className="flex items-center gap-2 flex-1">
                <div className={cn(
                  'p-2 rounded-lg',
                  contact.isGroup 
                    ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                    : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                )}>
                  {contact.isGroup ? (
                    <Users className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                
                <div className="text-left flex-1">
                  <div className="font-medium text-sm text-gray-800 dark:text-gray-200">
                    {contact.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {contact.isGroup ? 'Grupo' : 'Contacto'} • {contact.jid}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {showResults && searchQuery.length >= 2 && searchResults.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4">
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
            No se encontraron contactos para "{searchQuery}"
          </div>
        </div>
      )}
    </div>
  );
};