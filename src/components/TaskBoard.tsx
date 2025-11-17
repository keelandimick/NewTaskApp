import React from 'react';
import { TaskColumn } from './TaskColumn';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { TaskStatus, ReminderStatus } from '../types';

interface TaskBoardProps {
  activeId: string | null;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ activeId }) => {
  const { 
    currentView,
    setCurrentView, 
    getFilteredItems,
    emptyTrash,
    currentListId,
    lists,
    setSelectedItem,
    items: allItems
  } = useStoreWithAuth();
  
  const items = getFilteredItems();

  const taskColumns: { id: TaskStatus; title: string }[] = [
    { id: 'start', title: 'Start' },
    { id: 'waiting', title: 'In Progress' },
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

  const trashColumns: { id: string; title: string }[] = [
    { id: 'trash', title: 'Trash' },
  ];

  const columns = currentView === 'tasks' ? taskColumns : 
                  currentView === 'reminders' ? reminderColumns : 
                  currentView === 'recurring' ? recurringColumns :
                  trashColumns;

  // Get the current view title and color
  const getViewInfo = () => {
    let title = 'All';
    
    // Show list name or special view name
    if (currentView === 'trash') {
      title = 'Trash';
    } else if (currentListId === 'all') {
      title = 'All';
    } else {
      const currentList = lists.find(l => l.id === currentListId);
      if (currentList) {
        title = currentList.name;
      }
    }
    
    // Get color based on current list (except for trash)
    let color = '#6B7280'; // Default gray
    if (currentView !== 'trash' && currentListId !== 'all') {
      const currentList = lists.find(l => l.id === currentListId);
      if (currentList) {
        color = currentList.color;
      }
    }
    
    return { title, color };
  };

  return (
    <>
      <div 
        className="flex flex-col h-full"
        onClick={(e) => {
          // Only deselect if clicking on the actual background
          const target = e.target as HTMLElement;
          if (target === e.currentTarget || 
              target.classList.contains('flex-1') ||
              target.classList.contains('gap-4') ||
              target.classList.contains('p-6')) {
            setSelectedItem(null);
          }
        }}
      >
        {/* View tabs */}
        {currentView !== 'trash' && (
          <div className="px-6 pt-4">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setCurrentView('tasks')}
                className={`px-4 py-2 border-b-2 -mb-px transition-all ${
                  currentView === 'tasks'
                    ? 'border-black text-black font-bold'
                    : 'border-transparent text-gray-500 font-medium hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📋 Tasks <span className="text-xs text-gray-400">({allItems.filter(item => 
                  !item.deletedAt && 
                  item.type === 'task' && 
                  item.status !== 'complete' &&
                  (currentListId === 'all' || item.listId === currentListId)
                ).length})</span>
              </button>
              <button
                onClick={() => setCurrentView('reminders')}
                className={`px-4 py-2 border-b-2 -mb-px transition-all ${
                  currentView === 'reminders'
                    ? 'border-black text-black font-bold'
                    : 'border-transparent text-gray-500 font-medium hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🔔 Reminders <span className="text-xs text-gray-400">({allItems.filter(item => 
                  !item.deletedAt && 
                  item.type === 'reminder' && 
                  !item.recurrence &&
                  item.status !== 'complete' &&
                  (currentListId === 'all' || item.listId === currentListId)
                ).length})</span>
              </button>
              <button
                onClick={() => setCurrentView('recurring')}
                className={`px-4 py-2 border-b-2 -mb-px transition-all ${
                  currentView === 'recurring'
                    ? 'border-black text-black font-bold'
                    : 'border-transparent text-gray-500 font-medium hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🔁 Recurring <span className="text-xs text-gray-400">({allItems.filter(item => 
                  !item.deletedAt && 
                  item.type === 'reminder' && 
                  item.recurrence &&
                  item.status !== 'complete' &&
                  (currentListId === 'all' || item.listId === currentListId)
                ).length})</span>
              </button>
            </div>
          </div>
        )}
        
        {/* Title header */}
        <div className="px-6 pt-2 pb-2">
          <h2 className="text-2xl font-semibold" style={{ color: getViewInfo().color }}>
            {getViewInfo().title}
          </h2>
        </div>
        
        {/* Header buttons */}
        <div className="flex justify-end px-6 pb-2">
          {currentView === 'trash' ? (
            <button
              onClick={async () => {
                if (window.confirm('Empty trash? This will permanently delete all items in trash.')) {
                  try {
                    await emptyTrash();
                  } catch (error) {
                    console.error('Failed to empty trash:', error);
                    alert('Failed to empty trash. Please try again.');
                  }
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Empty Trash
            </button>
          ) : null}
        </div>
        
        <div className="flex gap-4 p-6 pt-3 flex-1 overflow-auto">
          {columns.map((column, index) => (
            <React.Fragment key={column.id}>
              <TaskColumn
              title={column.title}
              columnId={column.id}
              items={currentView === 'trash' ? items : items.filter(item => item.status === column.id)}
            />
              {index < columns.length - 1 && (
                <div className="w-px bg-gray-200" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </>
  );
};