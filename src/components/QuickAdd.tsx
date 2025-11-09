import React, { useEffect, useRef, useState } from 'react';
import { useStoreWithAuth } from '../store/useStoreWithAuth';

export const QuickAdd: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { addItem, currentListId, currentView } = useStoreWithAuth();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        e.stopPropagation();
        setIsActive(true);
        return false;
      } else if (e.key === 'Escape' && isActive) {
        setIsActive(false);
        setTitle('');
      }
    };

    // Use capture phase to intercept before browser
    document.addEventListener('keydown', handleKeyPress, true);
    return () => document.removeEventListener('keydown', handleKeyPress, true);
  }, [isActive]);

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      if (currentView === 'tasks') {
        await addItem({
          type: 'task',
          title: title.trim(),
          priority: 'low',
          status: 'start',
          listId: currentListId,
        });
      } else {
        await addItem({
          type: 'reminder',
          title: title.trim(),
          priority: 'low',
          status: 'within7',
          listId: currentListId,
        });
      }

      setTitle('');
      setIsActive(false);
    } catch (error) {
      console.error('Failed to add item:', error);
      // Optionally show an error message to the user
      alert('Failed to add item. Please try again.');
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-2">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Add ${currentView === 'tasks' ? 'task' : 'reminder'}...`}
          className="w-96 px-3 py-2 border-0 focus:outline-none focus:ring-0"
        />
      </form>
    </div>
  );
};