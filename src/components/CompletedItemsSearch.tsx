import React, { useState, useRef, useEffect } from 'react';
import { Item } from '../types';
import { format } from 'date-fns';

interface CompletedItemsSearchProps {
  items: Item[]; // All completed items
  lists: { id: string; name: string; color: string }[];
  onResultClick: (itemId: string) => void;
}

export const CompletedItemsSearch: React.FC<CompletedItemsSearchProps> = ({
  items,
  lists,
  onResultClick
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter completed items based on query
  const getSearchResults = (): Item[] => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase().trim();
    const queryTerms = lowerQuery.split(/\s+/);

    return items.filter(item => {
      // Check title
      const titleMatch = queryTerms.every(term =>
        item.title.toLowerCase().includes(term)
      );
      if (titleMatch) return true;

      // Check notes
      const notesMatch = item.notes.some(note =>
        queryTerms.every(term => note.content.toLowerCase().includes(term))
      );
      if (notesMatch) return true;

      // Check attachment file names
      const attachmentMatch = item.attachments.some(att =>
        queryTerms.every(term => att.fileName.toLowerCase().includes(term))
      );
      if (attachmentMatch) return true;

      return false;
    });
  };

  const results = getSearchResults();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      const item = results[selectedIndex];
      // Only allow clicking if item has notes or attachments
      if (item.notes.length > 0 || item.attachments.length > 0) {
        handleResultClick(item);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleResultClick = (item: Item) => {
    // Only allow clicking if item has notes or attachments
    if (item.notes.length === 0 && item.attachments.length === 0) return;

    onResultClick(item.id);
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsOpen(newQuery.trim().length > 0);
    setSelectedIndex(0);
  };

  const getListName = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    return list?.name || 'Unknown';
  };

  const getListColor = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    return list?.color || '#3B82F6';
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className="bg-yellow-200">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const hasNotesOrAttachments = (item: Item) =>
    item.notes.length > 0 || item.attachments.length > 0;

  return (
    <div className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && setIsOpen(true)}
          placeholder="Search completed items..."
          className="w-64 pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg
                   bg-white text-gray-900 placeholder-gray-400
                   focus:outline-none focus:ring-2 focus:ring-blue-500
                   transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-2 w-96 max-h-96 overflow-y-auto
                   bg-white border border-gray-200 rounded-lg shadow-lg z-50"
        >
          <div className="py-2">
            {results.map((item: Item, index: number) => {
              const isClickable = hasNotesOrAttachments(item);

              return (
                <div
                  key={item.id}
                  onClick={() => isClickable && handleResultClick(item)}
                  className={`w-full px-4 py-3 text-left transition-colors
                    ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                    ${index === selectedIndex ? 'bg-blue-50' : isClickable ? 'hover:bg-gray-50' : ''}
                    ${!isClickable ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 mb-1 line-through">
                        {highlightMatch(item.title, query)}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getListColor(item.listId) }}
                          />
                          {getListName(item.listId)}
                        </span>

                        <span>•</span>

                        <span className="capitalize">
                          {item.type === 'reminder' && item.recurrence ? 'Recurring' : item.type}
                        </span>

                        {/* Show notes/attachments count */}
                        {item.notes.length > 0 && (
                          <>
                            <span>•</span>
                            <span>📝 {item.notes.length}</span>
                          </>
                        )}

                        {item.attachments.length > 0 && (
                          <>
                            <span>•</span>
                            <span>📎 {item.attachments.length}</span>
                          </>
                        )}
                      </div>

                      {/* Show note snippet if notes match */}
                      {item.notes.some(n => n.content.toLowerCase().includes(query.toLowerCase())) && (
                        <div className="mt-1.5 text-xs text-gray-600 line-clamp-2">
                          {item.notes.find(n => n.content.toLowerCase().includes(query.toLowerCase()))?.content}
                        </div>
                      )}

                      {/* Indicator for non-clickable items */}
                      {!isClickable && (
                        <div className="mt-1 text-xs text-gray-400 italic">
                          No notes or attachments
                        </div>
                      )}
                    </div>

                    {/* Priority badge */}
                    <div className={`px-2 py-0.5 rounded text-xs font-medium capitalize
                      ${item.priority === 'now' ? 'bg-red-100 text-red-700' : ''}
                      ${item.priority === 'high' ? 'bg-orange-100 text-orange-700' : ''}
                      ${item.priority === 'low' ? 'bg-blue-100 text-blue-700' : ''}
                    `}>
                      {item.priority}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-200">
            {results.length} result{results.length > 1 ? 's' : ''} • Click items with 📝 or 📎 to view
          </div>
        </div>
      )}

      {/* No results message */}
      {isOpen && query.trim() && results.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-2 w-96
                   bg-white border border-gray-200 rounded-lg shadow-lg z-50 px-4 py-8"
        >
          <div className="text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">No completed items found for "{query}"</p>
          </div>
        </div>
      )}
    </div>
  );
};
