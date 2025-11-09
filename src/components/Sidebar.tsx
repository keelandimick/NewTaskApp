import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { ViewMode } from '../types';

interface DroppableListItemProps {
  list: any;
  isActive: boolean;
  itemCount: number;
  onSelect: () => void;
  onDelete?: () => Promise<void>;
}

const DroppableListItem: React.FC<DroppableListItemProps> = ({ list, isActive, itemCount, onSelect, onDelete }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `list-${list.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`group relative w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center ${
        isActive
          ? 'bg-gray-200 text-gray-900'
          : 'text-gray-700 hover:bg-gray-100'
      } ${isOver ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
    >
      <button
        onClick={onSelect}
        className="flex items-center flex-1"
      >
        <span
          className="w-3 h-3 rounded-full mr-2"
          style={{ backgroundColor: list.color }}
        />
        <span className="flex-1">{list.name}</span>
        {list.isLocked && (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
      </button>
      
      {list.id !== 'default' && onDelete && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { lists, currentListId, setCurrentList, currentView, setCurrentView, addList, deleteList, items } = useStoreWithAuth();
  const showLists = currentView === 'tasks';

  const viewOptions: { value: ViewMode; label: string; icon: string }[] = [
    { value: 'tasks', label: 'Tasks', icon: '📋' },
    { value: 'reminders', label: 'Reminders', icon: '🔔' },
    { value: 'recurring', label: 'Recurring', icon: '🔁' },
  ];

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 h-screen flex flex-col">
      <div className="p-4">
        <h1 className="text-xl font-semibold text-gray-800">Task Manager</h1>
      </div>

      <div className="px-4 pb-4">
        <div className="space-y-1">
          {viewOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setCurrentView(option.value)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                currentView === option.value
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="mr-2">{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {showLists && (
        <div className="flex-1 px-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-medium text-gray-600 uppercase">Lists</h2>
            <button
              onClick={async () => {
                const name = prompt('Enter list name:');
                if (name) {
                  try {
                    await addList({
                      name,
                      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
                    });
                  } catch (error) {
                    console.error('Failed to add list:', error);
                    alert('Failed to add list. Please try again.');
                  }
                }
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="space-y-1">
            {lists.map((list) => (
              <DroppableListItem
                key={list.id}
                list={list}
                isActive={currentListId === list.id}
                itemCount={items.filter(item => item.listId === list.id).length}
                onSelect={() => setCurrentList(list.id)}
                onDelete={list.id !== 'default' ? async () => {
                  const listTasks = items.filter(item => item.listId === list.id);
                  const message = listTasks.length > 0
                    ? `Delete list "${list.name}" and its ${listTasks.length} items?`
                    : `Delete list "${list.name}"?`;
                  
                  if (window.confirm(message)) {
                    try {
                      await deleteList(list.id);
                    } catch (error) {
                      console.error('Failed to delete list:', error);
                      alert('Failed to delete list. Please try again.');
                    }
                  }
                } : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};