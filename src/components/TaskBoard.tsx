import React from 'react';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { TaskStatus, ReminderStatus } from '../types';
import { Notes } from './Notes';
import { useAuth } from '../contexts/AuthContext';
import { SearchBar } from './SearchBar';
import { categorizeItems } from '../lib/ai';

interface TaskBoardProps {
  activeId: string | null;
  notesOpen: boolean;
  onMobileBack: () => void;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ activeId, notesOpen, onMobileBack }) => {
  const {
    currentView,
    setCurrentView,
    displayMode,
    setDisplayMode,
    getFilteredItems,
    emptyTrash,
    currentListId,
    lists,
    setSelectedItem,
    setHighlightedItem,
    setCurrentList,
    items: allItems,
    updateItem,
    signOut
  } = useStoreWithAuth();
  const { user } = useAuth();
  const [darkMode, setDarkMode] = React.useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [isCategorizing, setIsCategorizing] = React.useState(false);
  const [categorizeProgress, setCategorizeProgress] = React.useState(0);

  const handleSearchResultClick = (itemId: string) => {
    // Find the item
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

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
    // Use setTimeout to ensure this happens after the view change useEffect
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

  // Get category columns based on current view
  const getCategoryColumns = () => {
    if (currentView === 'tasks') {
      // For tasks: Use AI-generated categories
      const categories = new Set<string>();
      items.forEach(item => {
        if (item.type === 'task' && item.category) {
          categories.add(item.category);
        }
      });

      const categoryList = Array.from(categories)
        .sort()
        .map(cat => ({ id: cat, title: cat }));

      // Always add "Uncategorized" at the bottom for tasks
      categoryList.push({ id: 'uncategorized', title: 'Uncategorized' });

      return categoryList;
    } else if (currentView === 'reminders') {
      // For reminders: Use status as categories (no uncategorized - all reminders have a status)
      return reminderColumns;
    } else if (currentView === 'recurring') {
      // For recurring: Use frequency as categories (no uncategorized - all recurring items have a frequency)
      return recurringColumns;
    }

    return [];
  };

  const columns = displayMode === 'category'
    ? getCategoryColumns()
    : currentView === 'tasks' ? taskColumns :
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

  // Reset to column view when switching to trash or complete (category not supported there)
  React.useEffect(() => {
    if ((currentView === 'trash' || currentView === 'complete') && displayMode === 'category') {
      setDisplayMode('column');
    }
  }, [currentView, displayMode, setDisplayMode]);

  // Force category view on mobile for better layout
  React.useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile && displayMode === 'column' && currentView !== 'trash' && currentView !== 'complete') {
        setDisplayMode('category');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [displayMode, currentView, setDisplayMode]);

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
        {/* Mobile back button */}
        <div className="md:hidden px-4 pt-3 pb-2">
          <button
            onClick={onMobileBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Lists</span>
          </button>
        </div>

        {/* View tabs */}
        <div className="px-6 pt-4 md:pt-4">
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
        
        {/* Title header with inline toggle */}
        <div className="px-6 pt-2 pb-2 flex items-center justify-center gap-4">
          <h2 className="text-2xl font-semibold" style={{ color: getViewInfo().color }}>
            {getViewInfo().title}
          </h2>

          {/* Column/Category toggle - inline with title, for Tasks, Reminders, and Recurring tabs - hidden on mobile */}
          {(currentView === 'tasks' || currentView === 'reminders' || currentView === 'recurring') && (
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setDisplayMode('column')}
                  className={`px-3 py-1 text-xs rounded transition-all ${
                    displayMode === 'column'
                      ? 'bg-white text-gray-900 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Column view - organize by status"
                >
                  Columns
                </button>
                <button
                  onClick={() => setDisplayMode('category')}
                  className={`px-3 py-1 text-xs rounded transition-all ${
                    displayMode === 'category'
                      ? 'bg-white text-gray-900 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Category view - organize by AI categories"
                >
                  Categories
                </button>
              </div>
              {/* Re-categorize refresh button - only show for Tasks view if uncategorized items exist */}
              {currentView === 'tasks' && displayMode === 'category' && (() => {
                // Check if there are any uncategorized items
                const hasUncategorized = items.some(item =>
                  item.type === 'task' &&
                  (!item.category || item.category === 'Uncategorized') &&
                  item.status !== 'complete'
                );

                if (!hasUncategorized) return null;

                return (
                  <button
                  onClick={async () => {
                    if (!window.confirm('Categorize uncategorized items? AI will review them and assign to existing or new categories.')) return;

                    setIsCategorizing(true);
                    setCategorizeProgress(0);

                    // Show at least 5% after 3 seconds if still at 0
                    const progressTimer = setTimeout(() => {
                      setCategorizeProgress(prev => prev === 0 ? 5 : prev);
                    }, 3000);

                    try {
                      const totalLists = lists.length;
                      for (let i = 0; i < lists.length; i++) {
                        const list = lists[i];

                        // Get ALL task items for context
                        const allListItems = allItems.filter(item =>
                          item.listId === list.id &&
                          !item.deletedAt &&
                          item.status !== 'complete' &&
                          item.type === 'task'
                        );

                        // Separate uncategorized items (to be categorized) from categorized items (for context)
                        const uncategorizedItems = allListItems.filter(item =>
                          !item.category || item.category === 'Uncategorized'
                        );

                        const categorizedItems = allListItems.filter(item =>
                          item.category && item.category !== 'Uncategorized'
                        );

                        if (uncategorizedItems.length > 0) {
                          // Update progress for this list
                          const baseProgress = (i / totalLists) * 100;
                          setCategorizeProgress(Math.round(Math.max(baseProgress, 5)));

                          const categorizations = await categorizeItems(
                            uncategorizedItems.map(item => ({ id: item.id, title: item.title })),
                            list.name,
                            categorizedItems.map(item => ({ id: item.id, title: item.title, category: item.category! }))
                          );

                          // Progress after AI completes
                          setCategorizeProgress(Math.round(baseProgress + (100 / totalLists) * 0.5));

                          await Promise.all(
                            categorizations.map(cat =>
                              updateItem(cat.id, { category: cat.category })
                            )
                          );

                          // Progress after updates complete
                          setCategorizeProgress(Math.round(((i + 1) / totalLists) * 100));
                        } else {
                          // Skip empty lists but update progress
                          setCategorizeProgress(Math.round(((i + 1) / totalLists) * 100));
                        }
                      }

                      await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (error) {
                      console.error('Re-categorization failed:', error);
                      alert('Failed to re-categorize. Please try again.');
                    } finally {
                      clearTimeout(progressTimer);
                      setIsCategorizing(false);
                      setCategorizeProgress(0);
                    }
                  }}
                  disabled={isCategorizing}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isCategorizing
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Categorize uncategorized items using AI"
                >
                  {isCategorizing ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </button>
                );
              })()}
            </div>
          )}

          {/* Empty Trash button - inline with title, only for Trash view */}
          {currentView === 'trash' && (
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
          )}
        </div>

        <div className="flex gap-4 p-6 pt-3 flex-1 overflow-auto">
          {displayMode === 'category' && (currentView === 'tasks' || currentView === 'reminders' || currentView === 'recurring') ? (
            <>
              {/* Single column category view with sub-headers - hide on mobile when notes open */}
              <div className={`flex-1 flex flex-col gap-3 overflow-auto ${notesOpen ? 'hidden md:flex' : ''}`}>
                {getCategoryColumns().map(category => {
                  let categoryItems: typeof items;

                  if (currentView === 'tasks') {
                    // For tasks: filter by category property
                    categoryItems = category.id === 'uncategorized'
                      ? items.filter(item => item.type === 'task' && !item.category && item.status !== 'complete')
                      : items.filter(item => item.type === 'task' && item.category === category.id && item.status !== 'complete');
                  } else if (currentView === 'reminders') {
                    // For reminders: filter by status (which matches category.id)
                    categoryItems = items.filter(item =>
                      item.type === 'reminder' &&
                      !item.recurrence &&
                      item.status === category.id
                    );
                  } else if (currentView === 'recurring') {
                    // For recurring: filter by recurrence frequency (which matches category.id)
                    categoryItems = items.filter(item =>
                      item.type === 'reminder' &&
                      item.recurrence &&
                      item.recurrence.frequency === category.id
                    );
                  } else {
                    categoryItems = [];
                  }

                  if (categoryItems.length === 0) return null;

                  return (
                    <div key={category.id}>
                      {/* Category sub-header */}
                      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2 px-2">
                        {category.title}
                      </h3>
                      {/* Items in this category */}
                      <div>
                        {categoryItems.map(item => (
                          <TaskCard key={item.id} item={item} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {notesOpen && (
                <>
                  <div className={`w-px bg-gray-200 ${notesOpen ? 'hidden md:block' : ''}`} />
                  <Notes isOpen={true} onMobileBack={() => setSelectedItem(null)} />
                </>
              )}
            </>
          ) : (
            <>
              {/* Standard column view - hide on mobile when notes open */}
              <div className={`flex gap-4 flex-1 ${notesOpen ? 'hidden md:flex' : 'flex'}`}>
                {columns.map((column, index) => (
                  <React.Fragment key={column.id}>
                    <TaskColumn
                      title={column.title}
                      columnId={column.id}
                      items={
                        currentView === 'trash'
                          ? items
                          : items.filter(item => item.status === column.id)
                      }
                    />
                    {index < columns.length - 1 && (
                      <div className="w-px bg-gray-200" />
                    )}
                  </React.Fragment>
                ))}
              </div>
              {notesOpen && (
                <>
                  <div className="hidden md:block w-px bg-gray-200" />
                  <Notes isOpen={true} onMobileBack={() => setSelectedItem(null)} />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Re-categorization Progress Modal */}
      {isCategorizing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-center">Re-categorizing Items</h3>

            <div className="mb-4">
              <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${categorizeProgress}%` }}
                />
              </div>
              <p className="text-center text-2xl font-bold text-blue-600 mt-4">
                {categorizeProgress}%
              </p>
            </div>

            <div className="text-center text-sm text-gray-600">
              Please wait while AI categorizes your items...
            </div>
          </div>
        </div>
      )}
    </>
  );
};