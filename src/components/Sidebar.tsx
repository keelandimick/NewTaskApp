import React, { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { TaskModal } from './TaskModal';
import { useAuth } from '../contexts/AuthContext';

interface DroppableListItemProps {
  list: any;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => Promise<void>;
}

const DroppableListItem: React.FC<DroppableListItemProps> = ({ list, isActive, onSelect, onDelete }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `list-${list.id}`,
    disabled: list.id === 'all', // Disable dropping on "All" list
  });
  
  const { updateList } = useStoreWithAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(list.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showCollaborateModal, setShowCollaborateModal] = useState(false);
  const [collaboratorEmails, setCollaboratorEmails] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  const isAllList = list.id === 'all';
  const hasCollaborators = list.sharedWith && list.sharedWith.length > 0;
  
  // Initialize collaborator emails when opening modal for shared lists
  useEffect(() => {
    if (showCollaborateModal && hasCollaborators) {
      setCollaboratorEmails(list.sharedWith?.join(', ') || '');
    }
  }, [showCollaborateModal, hasCollaborators, list.sharedWith]);
  
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#14B8A6', // teal
    '#F97316', // orange
  ];
  
  // Close color picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showColorPicker) {
        const target = e.target as HTMLElement;
        if (!target.closest('.color-picker-' + list.id)) {
          setShowColorPicker(false);
        }
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showColorPicker, list.id]);

  return (
    <>
      <div
        ref={setNodeRef}
        className={`group relative w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center ${
          isActive
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        } ${isOver ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
      >
      <div
        onClick={onSelect}
        className="flex items-center flex-1 cursor-pointer"
      >
        {/* Color picker */}
        <div className={`relative color-picker-${list.id}`}>
          <div
            className="w-3 h-3 rounded-full mr-2 cursor-pointer hover:ring-2 hover:ring-gray-300 flex-shrink-0"
            style={{ backgroundColor: list.color }}
            onClick={(e) => {
              if (!isAllList) {
                e.stopPropagation();
                setShowColorPicker(!showColorPicker);
              }
            }}
          />
          {showColorPicker && (
            <div className="absolute left-0 top-5 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 w-64">
              <div className="grid grid-cols-4 gap-3">
                {colors.map((color) => (
                  <button
                    key={color}
                    className="w-12 h-12 rounded-lg hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await updateList(list.id, { color });
                        setShowColorPicker(false);
                      } catch (error) {
                        console.error('Failed to update list color:', error);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* List name */}
        {isEditingName && !isAllList ? (
          <input
            ref={nameInputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={async () => {
              if (editName.trim() && editName !== list.name) {
                try {
                  await updateList(list.id, { name: editName.trim() });
                } catch (error) {
                  console.error('Failed to update list name:', error);
                  setEditName(list.name);
                }
              }
              setIsEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                setEditName(list.name);
                setIsEditingName(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 m-0"
            autoFocus
            spellCheck="true"
          />
        ) : (
          <span
            className="flex-1"
            onDoubleClick={() => {
              if (!isAllList) {
                setIsEditingName(true);
                setEditName(list.name);
              }
            }}
          >
            {list.name}
          </span>
        )}
        
        {/* Collaborator indicator - clickable for shared lists */}
        {hasCollaborators && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCollaborateModal(true);
            }}
            className="ml-2"
            title="Manage collaborators"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        )}
        
        {list.isLocked && (
          <svg className="w-4 h-4 text-gray-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
      </div>
      
      
      {list.id !== 'default' && list.id !== 'all' && (
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Collaborate button - only show if not already shared */}
          {!hasCollaborators && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCollaborateModal(true);
              }}
              className="p-1 text-gray-400 hover:text-blue-600"
              title="Share with collaborators"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
          )}
          
          {/* Delete button */}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 text-gray-400 hover:text-red-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
      
      {/* Spacer for "All" list to align with deletable lists */}
      {list.id === 'all' && (
        <div className="w-6 h-6"></div>
      )}
      </div>
      
      {/* Collaborate Modal */}
      {showCollaborateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowCollaborateModal(false)}>
          <div 
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
          <h3 className="text-lg font-semibold mb-4">
            {hasCollaborators ? 'Manage Collaborators' : 'Share'} "{list.name}"
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {hasCollaborators
              ? 'Add or remove collaborators (separate emails with commas). Collaborators can edit items and work together in real-time.'
              : 'Enter email addresses separated by commas. Collaborators will be able to edit items and work together in real-time.'}
          </p>
          <textarea
            value={collaboratorEmails}
            onChange={(e) => setCollaboratorEmails(e.target.value)}
            placeholder="john@example.com, jane@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            rows={3}
          />
          {hasCollaborators && (
            <div className="mb-4">
              <button
                onClick={async () => {
                  try {
                    await updateList(list.id, { sharedWith: [] });
                    setShowCollaborateModal(false);
                    setCollaboratorEmails('');
                  } catch (error) {
                    console.error('Failed to remove all collaborators:', error);
                  }
                }}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Remove all collaborators
              </button>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowCollaborateModal(false);
                setCollaboratorEmails('');
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                const emails = collaboratorEmails.split(',').map(e => e.trim()).filter(e => e);
                if (emails.length > 0) {
                  try {
                    // Import db to check if users exist
                    const { db } = await import('../lib/database');
                    
                    // Check which emails exist
                    const results = await db.checkUsersExist(emails);
                    const validEmails = results.filter(r => r.exists).map(r => r.email);
                    const invalidEmails = results.filter(r => !r.exists).map(r => r.email);
                    
                    if (invalidEmails.length > 0) {
                      alert(`The following email(s) don't have FlowTask accounts: ${invalidEmails.join(', ')}`);
                      return;
                    }
                    
                    if (validEmails.length > 0) {
                      await updateList(list.id, { sharedWith: validEmails });
                      setShowCollaborateModal(false);
                      setCollaboratorEmails('');
                    }
                  } catch (error) {
                    console.error('Failed to share list:', error);
                    alert('Failed to share list. Please try again.');
                  }
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {hasCollaborators ? 'Update' : 'Share'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export const Sidebar: React.FC = () => {
  const { lists, currentListId, setCurrentList, currentView, setCurrentView, addList, deleteList, items, loading, addItem, deleteItem } = useStoreWithAuth();
  const { user } = useAuth();
  const userId = user?.id;

  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [showAllList, setShowAllList] = React.useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load showAllList preference from localStorage when user is available
  React.useEffect(() => {
    if (userId) {
      const saved = localStorage.getItem(`showAllList-${userId}`);
      setShowAllList(saved === null ? true : saved === 'true');
    }
  }, [userId]);

  // Ensure a list is selected when lists are loaded
  React.useEffect(() => {
    if (!loading && !currentListId) {
      setCurrentList('all');
    }
  }, [loading, currentListId, setCurrentList]);

  // Handle hiding "All" list while it's selected
  React.useEffect(() => {
    if (!showAllList && currentListId === 'all' && lists.length > 0) {
      // Select the first available list
      setCurrentList(lists[0].id);
    }
  }, [showAllList, currentListId, lists, setCurrentList]);

  // Keyboard shortcut: Cmd+I / Ctrl+I to open Add Item modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        setShowCreateModal(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);

    // Small delay to ensure progress modal renders before continuing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Close settings modal after progress modal is visible
    setShowSettingsModal(false);

    try {
      // Convert file to base64 - wrapped in Promise to properly await
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64 = reader.result?.toString().split(',')[1];
            if (!base64) {
              reject(new Error('Failed to read file'));
              return;
            }

            setImportProgress(25); // File loaded

            // Import the extractTasksFromImage function
            const { extractTasksFromImage } = await import('../lib/ai');

            setImportProgress(30); // Starting AI processing

            // Extract tasks from image
            const extractedTasks = await extractTasksFromImage(
              base64,
              file.type.includes('pdf') ? 'pdf' : 'image',
              lists.map(l => ({ id: l.id, name: l.name }))
            );

            setImportProgress(75); // AI done, adding tasks

            // Import Chrono for date parsing
            const customChrono = (await import('../lib/chronoConfig')).default;

            // Filter out duplicates before adding (exclude completed items)
            const existingTitles = new Set(
              items.filter(item => !item.deletedAt && item.status !== 'complete')
                .map(item => item.title.toLowerCase())
            );

            const uniqueTasks = extractedTasks.filter(task =>
              !existingTitles.has(task.title.toLowerCase())
            );

            const skippedCount = extractedTasks.length - uniqueTasks.length;

            // Add all unique tasks in parallel for better performance
            const addPromises = uniqueTasks.map(task => {
              let type: 'task' | 'reminder' = 'task';
              let title = task.title;
              let reminderDate = null;
              let recurrence = undefined;
              let status: any = 'start';

              // Check for recurring patterns first
              const recurringMatch = title.match(/\b(every\s+(other\s+)?\d*\s*(day|week|month|year|hours?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly|monthly|yearly|annually|weekdays?|weekends?)\b/i);
              if (recurringMatch) {
                // Extract recurrence and clean title
                title = title.replace(recurringMatch[0], '').trim();
                if (title.length > 0) {
                  title = title.charAt(0).toUpperCase() + title.slice(1);
                }
                type = 'reminder';
                recurrence = {
                  frequency: 'weekly' as const,
                  time: '09:00',
                  originalText: recurringMatch[0]
                };
                status = 'weekly'; // Set status to match frequency
              } else {
                // Check for single date
                const parsedDate = customChrono.parseDate(title);
                if (parsedDate) {
                  const parsedText = customChrono.parse(title)[0].text;
                  title = title.replace(parsedText, '').trim();
                  if (title.length > 0) {
                    title = title.charAt(0).toUpperCase() + title.slice(1);
                  }
                  type = 'reminder';
                  reminderDate = parsedDate;

                  // Calculate and set the appropriate status
                  const now = new Date();
                  const reminderDateOnly = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
                  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const diffTime = reminderDateOnly.getTime() - todayStart.getTime();
                  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                  if (diffDays < 0) {
                    status = 'today';
                  } else if (diffDays === 0) {
                    status = 'today';
                  } else if (diffDays <= 7) {
                    status = 'within7';
                  } else {
                    status = '7plus';
                  }
                }
              }

              const itemData: any = {
                type,
                title,
                priority: task.priority,
                status,
                listId: task.listId,
                recurrence
              };

              // Only add reminderDate for reminder type
              if (type === 'reminder' && reminderDate) {
                itemData.reminderDate = reminderDate;
              }

              return addItem(itemData);
            });

            await Promise.all(addPromises);

            setImportProgress(100); // Complete
            if (skippedCount > 0) {
              alert(`Successfully imported ${uniqueTasks.length} tasks! (${skippedCount} duplicates skipped)`);
            } else {
              alert(`Successfully imported ${uniqueTasks.length} tasks!`);
            }

            resolve();
          } catch (error) {
            reject(error);
          }
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import tasks. Please try again.');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <aside className="w-full md:w-64 bg-gray-50 border-r border-gray-200 h-screen flex flex-col">
      <div className="p-4">
        <h1 className="text-xl font-semibold text-gray-800">FlowTask</h1>
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full px-4 py-2 text-sm font-medium text-gray-700 border border-gray-400 hover:bg-gray-50 rounded-lg transition-colors"
        >
          + Add item
        </button>
      </div>

      <div className="mx-4 border-b border-gray-200"></div>

      <div className="px-4 pt-4 pb-4">
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
            {/* All items list */}
            {showAllList && (
              <DroppableListItem
                key="all"
                list={{ 
                  id: 'all', 
                  name: 'All', 
                  color: '#6B7280',
                  isLocked: false,
                  createdAt: new Date(),
                  updatedAt: new Date()
                } as any}
                isActive={currentListId === 'all' && currentView !== 'trash' && currentView !== 'complete'}
                onSelect={() => {
                  setCurrentList('all');
                  if (currentView === 'trash' || currentView === 'complete') setCurrentView('tasks');
                }}
              />
            )}
            
            {/* Personal lists (not shared) */}
            {lists.filter(list => !list.sharedWith || list.sharedWith.length === 0).map((list) => (
              <DroppableListItem
                key={list.id}
                list={list}
                isActive={currentListId === list.id && currentView !== 'trash' && currentView !== 'complete'}
                onSelect={() => {
                  setCurrentList(list.id);
                  if (currentView === 'trash' || currentView === 'complete') setCurrentView('tasks');
                }}
                onDelete={list.id !== 'default' ? async () => {
                  const listTasks = items.filter(item => item.listId === list.id && !item.deletedAt && item.status !== 'complete');
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
            
            {/* Shared lists section */}
            {lists.some(list => list.sharedWith && list.sharedWith.length > 0) && (
              <>
                <div className="px-3 py-2 mt-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Shared</h3>
                </div>
                {lists.filter(list => list.sharedWith && list.sharedWith.length > 0).map((list) => (
                  <DroppableListItem
                    key={list.id}
                    list={list}
                    isActive={currentListId === list.id && currentView !== 'trash' && currentView !== 'complete'}
                    onSelect={() => {
                      setCurrentList(list.id);
                      if (currentView === 'trash' || currentView === 'complete') setCurrentView('tasks');
                    }}
                    onDelete={list.id !== 'default' ? async () => {
                      const listTasks = items.filter(item => item.listId === list.id && !item.deletedAt && item.status !== 'complete');
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
              </>
            )}
          </div>
        </div>

      {/* Complete and Trash tabs at the bottom */}
      <div className="mt-auto px-4 space-y-2">
        <button
          onClick={() => {
            setCurrentView('complete');
            setCurrentList(''); // Clear the selected list when complete is selected
          }}
          className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
            currentView === 'complete'
              ? 'bg-green-100 text-green-700'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <span className="mr-2">✓</span>
          Complete
        </button>
        
        <button
          onClick={() => {
            setCurrentView('trash');
            setCurrentList(''); // Clear the selected list when trash is selected
          }}
          className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
            currentView === 'trash'
              ? 'bg-red-100 text-red-700'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <span className="mr-2">🗑️</span>
          Trash
        </button>
        
        {/* Things button */}
        <button
          onClick={() => setShowSettingsModal(true)}
          className="w-full text-left px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <span className="mr-2">⚙️</span>
          Things
        </button>
      </div>
      
      <div className="pb-4"></div>
      
      <TaskModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
        }}
        mode="create"
        defaultColumn="start"
      />
      
      {/* Things Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowSettingsModal(false)}>
          <div 
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Things</h3>
            
            <div className="space-y-4">
              {/* Import from Image/PDF */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className={`w-full px-4 py-2 text-left rounded-lg transition-colors flex items-center ${
                  isImporting 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {isImporting ? (
                  <>
                    <span className="mr-2">⏳</span>
                    <div className="flex-1">
                      <span>Importing...</span>
                      <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                        <div 
                          className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${importProgress}%` }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="mr-2">📷</span>
                    Import from Image/PDF
                  </>
                )}
              </button>
              
              {/* Show "All" list toggle */}
              <div className="flex items-center justify-between px-4 py-2 rounded-lg hover:bg-gray-100">
                <label className="flex items-center cursor-pointer flex-1">
                  <span className="mr-2">📋</span>
                  <span className="flex-1">Show "All" list</span>
                  <input
                    type="checkbox"
                    checked={showAllList}
                    onChange={(e) => {
                      const newValue = e.target.checked;
                      setShowAllList(newValue);
                      if (userId) {
                        localStorage.setItem(`showAllList-${userId}`, newValue.toString());
                      }
                    }}
                    className="ml-3 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>
              </div>

              {/* Clear Data button */}
              <button
                onClick={async () => {
                  if (window.confirm('Are you sure you want to clear all data? This will delete all tasks, lists, and notes permanently.')) {
                    try {
                      // Delete all items
                      const deleteItemPromises = items.map(item => deleteItem(item.id));
                      await Promise.all(deleteItemPromises);
                      
                      // Delete all non-default lists
                      const deleteListPromises = lists
                        .filter(list => list.id !== 'default')
                        .map(list => deleteList(list.id));
                      await Promise.all(deleteListPromises);
                      
                      alert('All data has been cleared successfully.');
                      setShowSettingsModal(false);
                    } catch (error) {
                      console.error('Failed to clear data:', error);
                      alert('Failed to clear data. Please try again.');
                    }
                  }
                }}
                className="w-full px-4 py-2 text-left rounded-lg text-red-600 hover:bg-red-50 transition-colors flex items-center"
              >
                <span className="mr-2">🗑️</span>
                Clear All Data
              </button>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileImport}
              className="hidden"
            />
          </div>
        </div>
      )}
      
      {/* Import Progress Modal */}
      {isImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Importing Tasks...</h3>
            
            <div className="mb-4">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {importProgress < 25 && 'Loading file...'}
                {importProgress >= 25 && importProgress < 30 && 'File loaded, preparing AI...'}
                {importProgress >= 30 && importProgress < 75 && 'AI is extracting tasks from image...'}
                {importProgress >= 75 && importProgress < 100 && 'Adding tasks to your lists...'}
                {importProgress === 100 && 'Import complete!'}
              </p>
            </div>
            
            <div className="text-center text-sm text-gray-500">
              Please wait while we process your file...
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};