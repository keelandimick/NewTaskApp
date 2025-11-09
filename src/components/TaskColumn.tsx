import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { Item } from '../types';
import { useStoreWithAuth } from '../store/useStoreWithAuth';

interface TaskColumnProps {
  title: string;
  items: Item[];
  columnId: string;
  onAddItem?: () => void;
}

export const TaskColumn: React.FC<TaskColumnProps> = ({ title, items, columnId, onAddItem }) => {
  const { currentView } = useStoreWithAuth();
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    disabled: currentView !== 'tasks', // Disable drop zones for reminders/recurring views
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col transition-colors ${
        isOver ? 'bg-blue-50' : ''
      }`}
    >
      <div className="flex justify-between items-center px-3 py-2 border-b border-gray-200">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</h3>
        <span className="text-xs text-gray-400">{items.length}</span>
      </div>

      <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1">
          {items.map((item) => (
            <TaskCard key={item.id} item={item} />
          ))}
          
          {onAddItem && (
            <button
              onClick={onAddItem}
              className="w-full px-3 py-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors text-left"
            >
              + Add item
            </button>
          )}
        </div>
      </SortableContext>
    </div>
  );
};