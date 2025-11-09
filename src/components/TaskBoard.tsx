import React from 'react';
import { TaskColumn } from './TaskColumn';
import { TaskModal } from './TaskModal';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { TaskStatus, ReminderStatus } from '../types';

interface TaskBoardProps {
  activeId: string | null;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ activeId }) => {
  const { 
    currentView, 
    getFilteredItems,
    sortMode,
    setSortMode
  } = useStoreWithAuth();
  
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [defaultColumn, setDefaultColumn] = React.useState<string>('');
  const items = getFilteredItems();

  const taskColumns: { id: TaskStatus; title: string }[] = [
    { id: 'start', title: 'Start' },
    { id: 'waiting', title: 'On Hold' },
    { id: 'complete', title: 'Complete' },
  ];

  const reminderColumns: { id: ReminderStatus; title: string }[] = [
    { id: 'today', title: 'Today' },
    { id: 'within7', title: 'Within 7 Days' },
    { id: '7plus', title: '7+ Days' },
    { id: 'complete', title: 'Complete' },
  ];

  const recurringColumns: { id: string; title: string }[] = [
    { id: 'daily', title: 'Daily' },
    { id: 'weekly', title: 'Weekly' },
    { id: 'monthly', title: 'Monthly' },
    { id: 'yearly', title: 'Yearly' },
  ];

  const columns = currentView === 'tasks' ? taskColumns : 
                  currentView === 'reminders' ? reminderColumns : 
                  recurringColumns;

  const handleAddItem = (columnId: string) => {
    setDefaultColumn(columnId);
    setShowCreateModal(true);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Sort toggle button */}
        <div className="flex justify-end px-6 pt-4">
          <button
            onClick={() => setSortMode(sortMode === 'custom' ? 'priority' : 'custom')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            {sortMode === 'custom' ? (
              currentView === 'tasks' ? 'Sort by Priority' : 
              currentView === 'reminders' ? 'Sort by Date' : 
              'Sort by Time'
            ) : 'Custom Sort'}
          </button>
        </div>
        
        <div className="flex gap-4 p-6 pt-3 flex-1">
          {columns.map((column) => (
            <TaskColumn
              key={column.id}
              title={column.title}
              columnId={column.id}
              items={items.filter(item => item.status === column.id)}
              onAddItem={() => handleAddItem(column.id)}
            />
          ))}
        </div>
      </div>

      <TaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mode="create"
        defaultColumn={defaultColumn}
      />
    </>
  );
};