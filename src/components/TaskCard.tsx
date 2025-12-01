import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Item, Priority } from '../types';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { format } from 'date-fns';
import { TaskModal } from './TaskModal';
import { renderTextWithLinks } from '../lib/ai';
import { formatRecurrence } from '../lib/formatRecurrence';
import { ContextMenu } from './ContextMenu';

interface TaskCardProps {
  item: Item;
}

const priorityColors: Record<Priority, string> = {
  now: 'bg-red-600',
  high: 'bg-orange-500',
  low: 'bg-green-600',
};

const priorityLabels: Record<Priority, string> = {
  now: 'Now',
  high: 'High',
  low: 'Low',
};

export const TaskCard: React.FC<TaskCardProps> = ({ item }) => {
  const { deleteItem, updateItem, currentView, highlightedItemId, lists, selectedItemId, setSelectedItem, setHighlightedItem, itemsInFlight, isDashboardView, setDashboardView, setCurrentView, setCurrentList, addAttachment } = useStoreWithAuth();
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showPriorityOptions, setShowPriorityOptions] = React.useState(false);
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState(item.title);
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(
    item.type === 'reminder' && item.reminderDate ? new Date(item.reminderDate) : null
  );
  const [showMoveToList, setShowMoveToList] = React.useState(false);
  const renameInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingFile, setIsUploadingFile] = React.useState(false);

  const isHighlighted = highlightedItemId === item.id;
  const isSelected = selectedItemId === item.id;
  
  // Check if item has an active "on hold" status in metadata
  const hasOnHoldNote = !!item.metadata?.onHold;
  
  // Handle delete key press when selected
  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't handle delete if user is typing in an input/textarea
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      );
      
      // Check for both Delete and Backspace keys
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace') && !isTyping && currentView !== 'trash' && currentView !== 'complete') {
        e.preventDefault();
        if (window.confirm(`Delete "${item.title}"?`)) {
          try {
            await deleteItem(item.id);
          } catch (error) {
            console.error('Failed to delete item:', error);
            alert('Failed to delete item. Please try again.');
          }
        }
      }
    };

    if (isSelected) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSelected, item.title, item.id, deleteItem, currentView]);
  
  // Close priority options on any click
  React.useEffect(() => {
    if (showPriorityOptions) {
      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        // Check if click is outside the priority options container
        if (!target.closest(`.priority-options-${item.id}`)) {
          setShowPriorityOptions(false);
        }
      };
      
      // Use capture phase to handle before other click handlers
      document.addEventListener('click', handleClick, true);
      
      return () => {
        document.removeEventListener('click', handleClick, true);
      };
    }
  }, [showPriorityOptions, item.id]);
  
  // Enable dragging for all views except trash and complete
  const isDraggable = currentView !== 'trash' && currentView !== 'complete';
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: item.id,
    disabled: !isDraggable
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = item.type === 'reminder' &&
    item.reminderDate &&
    new Date(item.reminderDate) < new Date() &&
    item.status !== 'complete';

  const isInFlight = itemsInFlight.has(item.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? 'opacity-20' : ''}`}
      data-item-id={item.id}
    >
      <div
        className={`flex items-center py-2 px-2 ${currentView !== 'trash' && currentView !== 'complete' ? 'cursor-pointer' : ''} border-b border-gray-100 transition-all duration-300 ${
          isInFlight ? 'opacity-50 pointer-events-none' : ''
        } ${
          isHighlighted ? 'bg-yellow-100 animate-pulse' : isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          if (currentView !== 'trash' && currentView !== 'complete') {
            if (selectedItemId === item.id) {
              // Click on already selected item - deselect it
              setSelectedItem(null);
              setHighlightedItem(null);
            } else {
              // Click on different item - select it
              setSelectedItem(item.id);
              setHighlightedItem(null);
            }
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();

          // Don't show context menu in trash or complete views
          if (currentView === 'trash' || currentView === 'complete') return;

          // Show context menu at click position
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {/* Loading spinner - show when item is in flight */}
        {isInFlight && (
          <div className="p-0.5">
            <svg className="w-3.5 h-3.5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {/* Drag handle - only show for tasks when not in flight */}
        {isDraggable && !isInFlight && (
          <div
            className="drag-handle p-0.5 cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
            {...attributes}
            {...listeners}
          >
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
        )}

        {/* Main content */}
        <div 
          className="flex-1 ml-1"
        >
          <div className="flex items-center gap-2">
            {/* Completion circle - show for tasks, reminders, and recurring */}
            {(currentView === 'tasks' || currentView === 'reminders' || currentView === 'recurring') && item.listId && (() => {
              const list = lists.find(l => l.id === item.listId);
              return list ? (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await updateItem(item.id, { status: 'complete' });
                    } catch (error) {
                      console.error('Failed to complete item:', error);
                    }
                  }}
                  className="w-3 h-3 rounded-full flex-shrink-0 border-2 hover:bg-gray-100 transition-colors" 
                  style={{ borderColor: list.color }}
                  title="Mark as complete"
                />
              ) : null;
            })()}
            
            <span className={`flex-1 text-[13.5px] ${
              item.status === 'complete' ? 'line-through text-gray-400' : 'text-gray-800'
            }`}>
              {renderTextWithLinks(item.title)}
              {hasOnHoldNote && (
                <span className="ml-2 text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                  ON HOLD
                </span>
              )}
            </span>
          </div>

          {/* Date/time on second line */}
          {(item.type === 'reminder' && item.reminderDate && currentView !== 'recurring') && (() => {
            const reminderDate = new Date(item.reminderDate);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const reminderDateOnly = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
            
            let dateLabel: string;
            if (reminderDateOnly.getTime() === today.getTime()) {
              dateLabel = `Today at ${format(reminderDate, 'h:mm a')}`;
            } else if (reminderDateOnly.getTime() === tomorrow.getTime()) {
              dateLabel = `Tomorrow at ${format(reminderDate, 'h:mm a')}`;
            } else {
              dateLabel = format(reminderDate, 'MMM d, h:mm a');
            }
            
            return (
              <div className={`text-[11px] mt-0.5 ${isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
                {dateLabel}
              </div>
            );
          })()}

          {item.recurrence && (
            <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {formatRecurrence(item.recurrence)}
            </div>
          )}
        </div>

        {/* Notes/Attachments indicators and Priority badge container */}
        {currentView !== 'trash' && currentView !== 'complete' && (
          <div className="flex items-center gap-2">
            {/* Attachments indicator */}
            {item.attachments.length > 0 && (
              <span className="text-base" title={`${item.attachments.length} attachment${item.attachments.length === 1 ? '' : 's'}`}>
                📎
              </span>
            )}
            {/* Notes indicator */}
            {item.notes.length > 0 && (
              <span className="text-base" title={`${item.notes.length} note${item.notes.length === 1 ? '' : 's'}`}>
                📝
              </span>
            )}

            {/* Priority badge */}
            <div className={`relative priority-options-${item.id}`}>
                {showPriorityOptions && (
                  <div className="absolute right-0 top-6 z-10 flex gap-1 bg-white rounded-lg shadow-lg p-1">
                    {(['now', 'high', 'low'] as Priority[]).map((priority) => (
                      <button
                        key={priority}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setShowPriorityOptions(false);
                          // Guard check: Don't update if priority is already the same
                          if (item.priority === priority) return;

                          const oldPriority = item.priority;
                          try {
                            await updateItem(item.id, { priority });

                            // Navigate if changing priority away from "now" while in Dashboard
                            if (isDashboardView && oldPriority === 'now' && priority !== 'now') {
                              setDashboardView(false);
                              setCurrentView('tasks');
                              setCurrentList(item.listId);

                              // Scroll to and highlight the item after navigation
                              setTimeout(() => {
                                const element = document.getElementById(`item-${item.id}`);
                                if (element) {
                                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                                setHighlightedItem(item.id);
                              }, 100);
                            } else {
                              // For non-dashboard views, just highlight and scroll (item stays in view)
                              setTimeout(() => {
                                const element = document.getElementById(`item-${item.id}`);
                                if (element) {
                                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                                setHighlightedItem(item.id);
                              }, 100);
                            }
                          } catch (error) {
                            console.error('Failed to update priority:', error);
                          }
                        }}
                        className={`text-[10px] font-medium text-white px-1.5 py-0.5 rounded-full cursor-pointer transition-all ${
                          item.priority === priority ? 'ring-2 ring-gray-400' : ''
                        } ${priorityColors[priority]}`}
                      >
                        {priorityLabels[priority]}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPriorityOptions(true);
                  }}
                  className={`text-[10px] font-medium text-white px-1.5 py-0.5 rounded-full cursor-pointer hover:ring-2 hover:ring-gray-300 transition-all ${priorityColors[item.priority]}`}
                >
                  {priorityLabels[item.priority]}
                </button>
            </div>
          </div>
        )}
      </div>

      <TaskModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        mode="edit"
        editItem={item}
      />

      {/* Rename Modal */}
      {isRenaming && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsRenaming(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Rename Task</h3>
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  await updateItem(item.id, { title: renameValue });
                  setIsRenaming(false);
                } else if (e.key === 'Escape') {
                  setIsRenaming(false);
                }
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new name"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setIsRenaming(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await updateItem(item.id, { title: renameValue });
                  setIsRenaming(false);
                }}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to List Modal */}
      {showMoveToList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowMoveToList(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Move to List</h3>
            <div className="space-y-2">
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={async () => {
                    await updateItem(item.id, { listId: list.id });
                    setShowMoveToList(false);

                    // In Dashboard view: no navigation, just update the list
                    if (isDashboardView) return;

                    // Determine target view based on item type
                    let targetView: 'tasks' | 'reminders' | 'recurring' = 'tasks';
                    if (item.recurrence) {
                      targetView = 'recurring';
                    } else if (item.type === 'reminder') {
                      targetView = 'reminders';
                    }

                    // Navigate to the new list and highlight
                    setCurrentList(list.id);
                    setCurrentView(targetView);

                    setTimeout(() => {
                      const element = document.getElementById(`item-${item.id}`);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                      setHighlightedItem(item.id);
                    }, 100);
                  }}
                  className={`w-full text-left px-4 py-3 rounded border ${
                    list.id === item.listId
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: list.color }}
                    />
                    <span className="font-medium">{list.name}</span>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowMoveToList(false)}
              className="w-full mt-4 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDatePicker(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">
              {item.type === 'reminder' && item.reminderDate ? 'Edit Date/Time' : 'Add Date/Time'}
            </h3>
            <input
              type="datetime-local"
              value={selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : ''}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(new Date(e.target.value));
                }
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 mt-4">
              {item.type === 'reminder' && item.reminderDate && (
                <button
                  onClick={async () => {
                    await updateItem(item.id, { type: 'task', status: 'start', reminderDate: null } as any);
                    setShowDatePicker(false);

                    // Navigate to tasks view and highlight
                    if (isDashboardView) setDashboardView(false);
                    setCurrentList(item.listId);
                    setCurrentView('tasks');

                    setTimeout(() => {
                      setSelectedItem(item.id);
                      setHighlightedItem(item.id);
                      setTimeout(() => {
                        const element = document.getElementById(`item-${item.id}`);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }, 100);
                    }, 50);
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded"
                >
                  Remove
                </button>
              )}
              <button
                onClick={() => setShowDatePicker(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (selectedDate) {
                    // Calculate appropriate status based on date
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                    const diffTime = selectedDateOnly.getTime() - todayStart.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    let status: 'today' | 'within7' | '7plus' = 'within7';
                    if (diffDays <= 0) status = 'today';
                    else if (diffDays <= 7) status = 'within7';
                    else status = '7plus';

                    await updateItem(item.id, {
                      reminderDate: selectedDate,
                      type: 'reminder',
                      status,
                    } as any);

                    setShowDatePicker(false);

                    // Navigate to reminders view and highlight
                    if (isDashboardView) setDashboardView(false);
                    setCurrentList(item.listId);
                    setCurrentView('reminders');

                    setTimeout(() => {
                      setSelectedItem(item.id);
                      setHighlightedItem(item.id);
                      setTimeout(() => {
                        const element = document.getElementById(`item-${item.id}`);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }, 100);
                    }, 50);
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          options={[
            {
              label: 'Rename',
              icon: '✏️',
              onClick: () => {
                setIsRenaming(true);
                setRenameValue(item.title);
                // Focus input after state update
                setTimeout(() => renameInputRef.current?.focus(), 0);
              },
            },
            {
              label: 'Move to List',
              icon: '📁',
              onClick: () => {
                setShowMoveToList(true);
              },
            },
            {
              label: item.type === 'reminder' && item.reminderDate ? 'Edit Date/Time' : 'Add Date/Time',
              icon: '📅',
              onClick: () => {
                setShowDatePicker(true);
                setSelectedDate(
                  item.type === 'reminder' && item.reminderDate
                    ? new Date(item.reminderDate)
                    : new Date()
                );
              },
              disabled: !!item.recurrence, // Disable for recurring items
            },
            {
              label: 'Add File',
              icon: '📎',
              onClick: () => {
                fileInputRef.current?.click();
              },
            },
            {
              label: 'Delete',
              icon: '🗑️',
              onClick: async () => {
                setContextMenu(null);
                if (window.confirm(`Delete "${item.title}"?`)) {
                  try {
                    await deleteItem(item.id);
                  } catch (error) {
                    console.error('Failed to delete item:', error);
                    alert('Failed to delete item. Please try again.');
                  }
                }
              },
            },
          ]}
        />
      )}

      {/* Hidden file input for attachments */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          // Validate file size (10MB max)
          if (file.size > 10 * 1024 * 1024) {
            alert('File too large. Maximum size is 10MB.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }

          setIsUploadingFile(true);
          try {
            await addAttachment(item.id, file);
            // Select the item to show the attachments panel
            setSelectedItem(item.id);
          } catch (error) {
            console.error('Failed to upload file:', error);
            alert('Failed to upload file. Please try again.');
          } finally {
            setIsUploadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }}
        className="hidden"
      />

      {/* Upload overlay spinner */}
      {isUploadingFile && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm text-blue-600">Uploading...</span>
          </div>
        </div>
      )}
    </div>
  );
};