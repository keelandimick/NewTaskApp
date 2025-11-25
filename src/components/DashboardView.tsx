import React from 'react';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { TaskCard } from './TaskCard';
import { SearchBar } from './SearchBar';
import { Notes } from './Notes';
import { useAuth } from '../contexts/AuthContext';
import { Item } from '../types';

export const DashboardView: React.FC = () => {
  const { items, currentListId, loading, setSelectedItem, setHighlightedItem, setCurrentList, setCurrentView, signOut, items: allItems, selectedItemId, setDashboardView } = useStoreWithAuth();
  const { user } = useAuth();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const notesOpen = !!selectedItemId;

  // Filter items by current list if one is selected
  const filteredByList = React.useMemo(() => {
    if (currentListId && currentListId !== 'all') {
      return items.filter(item => !item.deletedAt && item.listId === currentListId);
    }
    return items.filter(item => !item.deletedAt);
  }, [items, currentListId]);

  // NOW Priority Tasks (non-recurring)
  const nowPriorityTasks = React.useMemo(() => {
    return filteredByList
      .filter(item =>
        item.priority === 'now' &&
        !item.recurrence &&
        item.status !== 'complete'
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first
  }, [filteredByList]);

  // Today & Upcoming Reminders (non-recurring, today or within7 status)
  const upcomingReminders = React.useMemo(() => {
    return filteredByList
      .filter(item =>
        item.type === 'reminder' &&
        !item.recurrence &&
        (item.status === 'today' || item.status === 'within7')
      )
      .sort((a, b) => {
        // Sort by reminder date if available
        const dateA = (a.type === 'reminder' && a.reminderDate) ? new Date(a.reminderDate).getTime() : new Date(a.createdAt).getTime();
        const dateB = (b.type === 'reminder' && b.reminderDate) ? new Date(b.reminderDate).getTime() : new Date(b.createdAt).getTime();
        return dateA - dateB; // Soonest first
      });
  }, [filteredByList]);

  // Daily & Weekly Recurring Items
  const recurringItems = React.useMemo(() => {
    return filteredByList
      .filter(item => {
        if (!item.recurrence) return false;
        return item.recurrence.frequency === 'daily' || item.recurrence.frequency === 'weekly';
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first
  }, [filteredByList]);

  // Check if dashboard has any items
  const dashboardItems = [...nowPriorityTasks, ...upcomingReminders, ...recurringItems];

  const handleSearchResultClick = (itemId: string) => {
    // Find the item
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    // Exit Dashboard
    setDashboardView(false);

    // Navigate to the item's list
    setCurrentList(item.listId);

    // Navigate to the correct view based on item type
    if (item.type === 'task') {
      setCurrentView('tasks');
    } else if (item.recurrence) {
      setCurrentView('recurring');
    } else {
      setCurrentView('reminders');
    }

    // Select and highlight the item after view/list change completes
    setTimeout(() => {
      setSelectedItem(itemId);
      setHighlightedItem(itemId);

      // Scroll to the item after selection
      setTimeout(() => {
        const element = document.getElementById(`item-${itemId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }, 50);
  };

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

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header section matching TaskBoard style */}
      <div className="px-6 pt-4">
        <div className="flex justify-between items-center border-b border-gray-200">
          {/* Empty left side (no tabs for Dashboard) */}
          <div className="flex h-10"></div>

          {/* Search and User info */}
          <div className="flex items-center gap-3 pb-2">
            <SearchBar onResultClick={handleSearchResultClick} />

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
          </div>
        </div>
      </div>

      {/* Title header matching TaskBoard style */}
      <div className="px-6 pt-2 pb-2 flex items-center justify-center">
        <h2 className="text-2xl font-semibold" style={{ color: '#8B5CF6' }}>
          Dashboard
        </h2>
      </div>

      {/* Dashboard content */}
      {dashboardItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 p-8">
          <svg
            className="w-24 h-24 text-purple-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-sm text-gray-500 text-center max-w-md">
            This is your dashboard and shows upcoming reminders, tasks with "Now" priority, and daily/weekly recurring items
          </p>
        </div>
      ) : (
        <div className="flex gap-4 p-6 pt-3 flex-1 overflow-auto">
          {/* Single column category-style view */}
          <div className="flex-1 flex flex-col gap-3 overflow-auto">
            {/* NOW Priority Tasks Section */}
            {nowPriorityTasks.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2 px-2">
                  ⚡️ Now Priority
                </h3>
                <div>
                  {nowPriorityTasks.map(item => (
                    <TaskCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Today & Upcoming Reminders Section */}
            {upcomingReminders.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2 px-2">
                  📅 Today & Upcoming
                </h3>
                <div>
                  {upcomingReminders.map(item => (
                    <TaskCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Recurring Items Section */}
            {recurringItems.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2 px-2">
                  🔄 Recurring
                </h3>
                <div>
                  {recurringItems.map(item => (
                    <TaskCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
          {notesOpen && (
            <>
              <div className="w-px bg-gray-200" />
              <Notes isOpen={true} />
            </>
          )}
        </div>
      )}
    </div>
  );
};
