import React from 'react';
import { TaskColumn } from './TaskColumn';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { TaskStatus, ReminderStatus } from '../types';
import { Notes } from './Notes';
import { useAuth } from '../contexts/AuthContext';

interface TaskBoardProps {
  activeId: string | null;
  notesOpen: boolean;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ activeId, notesOpen }) => {
  const { 
    currentView,
    setCurrentView, 
    getFilteredItems,
    emptyTrash,
    currentListId,
    lists,
    setSelectedItem,
    items: allItems,
    signOut
  } = useStoreWithAuth();
  const { user } = useAuth();
  const [darkMode, setDarkMode] = React.useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  
  const items = getFilteredItems();

  const taskColumns: { id: TaskStatus; title: string }[] = [
    { id: 'start', title: 'Start' },
    { id: 'in-progress', title: 'In Progress' },
  ];

  const reminderColumns: { id: ReminderStatus; title: string }[] = [
    { id: 'today', title: 'Today' },
    { id: 'within7', title: 'Within 7 Days' },
    { id: '7plus', title: '7+ Days' },
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

  const completeColumns: { id: string; title: string }[] = [
    { id: 'complete', title: 'Completed Items' },
  ];

  const columns = currentView === 'tasks' ? taskColumns : 
                  currentView === 'reminders' ? reminderColumns : 
                  currentView === 'recurring' ? recurringColumns :
                  currentView === 'trash' ? trashColumns :
                  completeColumns;

  // Get the current view title and color
  const getViewInfo = () => {
    let title = 'All';
    
    // Show list name or special view name
    if (currentView === 'trash') {
      title = 'Trash';
    } else if (currentView === 'complete') {
      title = 'Complete';
    } else if (currentListId === 'all') {
      title = 'All';
    } else {
      const currentList = lists.find(l => l.id === currentListId);
      if (currentList) {
        title = currentList.name;
      }
    }
    
    // Get color based on current list (except for trash and complete)
    let color = '#6B7280'; // Default gray
    if (currentView !== 'trash' && currentView !== 'complete' && currentListId !== 'all') {
      const currentList = lists.find(l => l.id === currentListId);
      if (currentList) {
        color = currentList.color;
      }
    }
    
    return { title, color };
  };

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  // Close user menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      // Small delay to prevent immediate close when opening
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [showUserMenu]);

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
            <div className="flex justify-between items-center border-b border-gray-200">
              <div className="flex">
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
              
              {/* User info and dark mode toggle */}
              <div className="flex items-center gap-3 pb-2">
                <div className="relative user-menu-container">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    {user?.email}
                  </button>
                  
                  {showUserMenu && (
                    <div className="absolute right-0 top-6 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                      <button
                        onClick={async () => {
                          if (window.confirm('Are you sure you want to sign out?')) {
                            await signOut();
                          }
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {darkMode ? (
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>
              </div>
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
              {(index < columns.length - 1 || notesOpen) && (
                <div className="w-px bg-gray-200" />
              )}
            </React.Fragment>
          ))}
          {notesOpen && (
            <Notes 
              isOpen={true}
            />
          )}
        </div>
      </div>
    </>
  );
};