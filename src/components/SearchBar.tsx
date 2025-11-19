import React, { useState, useRef, useEffect } from 'react';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { Item } from '../types';
import { format } from 'date-fns';

interface SearchBarProps {
  onResultClick: (itemId: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onResultClick }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { searchItems, lists } = useStoreWithAuth();
  const results = searchItems(query);

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

  // Global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(query.trim().length > 0);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [query]);

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
      handleResultClick(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleResultClick = (item: Item) => {
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

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'MMM d, yyyy');
    } catch {
      return '';
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className="bg-yellow-200 dark:bg-yellow-900">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && setIsOpen(true)}
          placeholder="Search... (⌘K)"
          className="w-64 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                   bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                   transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600
                     dark:text-gray-500 dark:hover:text-gray-300"
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
                   bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                   rounded-lg shadow-lg z-50"
        >
          <div className="py-2">
            {results.map((item: Item, index: number) => (
              <button
                key={item.id}
                onClick={() => handleResultClick(item)}
                className={`w-full px-4 py-3 text-left transition-colors
                  ${
                    index === selectedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/30'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {highlightMatch(item.title, query)}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lists.find(l => l.id === item.listId)?.color || '#3B82F6' }}></span>
                        {getListName(item.listId)}
                      </span>

                      <span>•</span>

                      <span className="capitalize">
                        {item.type === 'reminder' && item.recurrence ? 'Recurring' : item.type}
                      </span>

                      {item.type === 'reminder' && item.reminderDate && (
                        <>
                          <span>•</span>
                          <span>{formatDate(item.reminderDate)}</span>
                        </>
                      )}

                      {item.notes.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{item.notes.length} note{item.notes.length > 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>

                    {/* Show note snippet if notes match */}
                    {item.notes.some((n: any) => n.content.toLowerCase().includes(query.toLowerCase())) && (
                      <div className="mt-1.5 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {item.notes.find((n: any) => n.content.toLowerCase().includes(query.toLowerCase()))?.content}
                      </div>
                    )}
                  </div>

                  <div className={`px-2 py-0.5 rounded text-xs font-medium capitalize
                    ${item.priority === 'now' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''}
                    ${item.priority === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : ''}
                    ${item.priority === 'low' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''}
                  `}>
                    {item.priority}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
            {results.length} result{results.length > 1 ? 's' : ''} found
          </div>
        </div>
      )}

      {/* No results message */}
      {isOpen && query.trim() && results.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-2 w-96
                   bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                   rounded-lg shadow-lg z-50 px-4 py-8"
        >
          <div className="text-center text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">No results found for "{query}"</p>
          </div>
        </div>
      )}
    </div>
  );
};
