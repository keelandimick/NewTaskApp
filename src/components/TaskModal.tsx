import React, { useState, useEffect } from 'react';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { Priority, RecurrenceFrequency, ViewMode, Item } from '../types';
import { format } from 'date-fns';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  editItem?: Item | null;
  defaultColumn?: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, mode, editItem, defaultColumn }) => {
  const { 
    addItem, 
    updateItem, 
    deleteItem,
    addNote,
    currentListId, 
    currentView, 
    setCurrentView, 
    setHighlightedItem 
  } = useStoreWithAuth();

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('low');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('daily');
  const [noteInput, setNoteInput] = useState('');

  // Initialize form with edit item data
  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setTitle('');
      setPriority('low');
      setDueDate('');
      setDueTime('');
      setIsRecurring(false);
      setRecurrenceFrequency('daily');
      setNoteInput('');
    } else if (mode === 'edit' && editItem) {
      setTitle(editItem.title);
      setPriority(editItem.priority);
      
      if (editItem.type === 'reminder' && editItem.reminderDate) {
        const date = new Date(editItem.reminderDate);
        setDueDate(format(date, 'yyyy-MM-dd'));
        setDueTime(format(date, 'HH:mm'));
      }
      
      if (editItem.recurrence) {
        setIsRecurring(true);
        setRecurrenceFrequency(editItem.recurrence.frequency);
        setDueTime(editItem.recurrence.time);
      }
    }
  }, [isOpen, mode, editItem]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        // Allow Enter from any field except textarea elements
        if (!(e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          handleSubmit();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, title, priority, dueDate, dueTime, isRecurring, recurrenceFrequency, mode, editItem, defaultColumn, currentListId, currentView]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!title.trim()) return;

    const hasDate = dueDate || isRecurring;
    const itemType = hasDate ? 'reminder' : 'task';

    let reminderDate: Date | undefined;
    if (dueDate) {
      reminderDate = new Date(`${dueDate}T${dueTime || '09:00'}`);
    }

    const recurrence = isRecurring ? {
      frequency: recurrenceFrequency,
      time: dueTime || '09:00',
    } : undefined;

    if (mode === 'create') {
      try {
        const newItemId = await addItem({
          type: itemType,
          title: title.trim(),
          priority,
          status: itemType === 'task' ? (defaultColumn as any || 'start') : 'within7',
          listId: currentListId,
          reminderDate,
          recurrence,
        } as any);

        // Navigate to the appropriate view and highlight the new item
        let targetView: ViewMode = 'tasks';
        if (isRecurring) {
          targetView = 'recurring';
        } else if (dueDate) {
          targetView = 'reminders';
        }

        if (targetView !== currentView) {
          setCurrentView(targetView);
        }
        setHighlightedItem(newItemId);
      } catch (error) {
        console.error('Failed to add item:', error);
      }
    } else if (mode === 'edit' && editItem) {
      try {
        // Update existing item
        await updateItem(editItem.id, {
          title: title.trim(),
          priority,
          reminderDate,
          recurrence,
          type: itemType,
        });

        // Navigate to the appropriate view and highlight if item type changed
        let targetView: ViewMode = 'tasks';
        if (isRecurring) {
          targetView = 'recurring';
        } else if (dueDate) {
          targetView = 'reminders';
        }

        if (targetView !== currentView) {
          setCurrentView(targetView);
        }
        setHighlightedItem(editItem.id);
      } catch (error) {
        console.error('Failed to update item:', error);
      }
    }

    onClose();
  };

  const handleAddNote = async () => {
    if (!noteInput.trim() || !editItem) return;
    try {
      await addNote(editItem.id, noteInput.trim());
      setNoteInput('');
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleDelete = async () => {
    if (!editItem) return;
    if (window.confirm(`Delete "${editItem.title}"?`)) {
      try {
        await deleteItem(editItem.id);
        onClose();
      } catch (error) {
        console.error('Failed to delete item:', error);
      }
    }
  };

  const priorities: { value: Priority; label: string }[] = [
    { value: 'now', label: 'Now' },
    { value: 'high', label: 'High' },
    { value: 'low', label: 'Low' },
  ];

  const frequencies: { value: RecurrenceFrequency; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50" onClick={onClose}>
      <div className="flex items-center justify-center min-h-screen p-4">
        <div 
          className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
          onClick={e => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold mb-4">
            {mode === 'create' ? 'New Item' : 'Edit Item'}
          </h2>

          {/* Title */}
          <div className="mb-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Priority</label>
            <div className="flex gap-2">
              {priorities.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    priority === p.value 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date/Time */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Due Date & Time</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                placeholder="09:00"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Recurrence */}
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                id="recurring-modal"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="recurring-modal" className="text-sm font-medium text-gray-700">
                Make recurring
              </label>
            </div>
            {isRecurring && (
              <div className="flex gap-2">
                {frequencies.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setRecurrenceFrequency(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      recurrenceFrequency === f.value 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes section for edit mode */}
          {mode === 'edit' && editItem && (
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Notes</label>
              <div className="max-h-32 overflow-y-auto mb-2 space-y-2">
                {editItem.notes.map(note => (
                  <div key={note.id} className="bg-gray-50 rounded p-2">
                    <p className="text-sm text-gray-800">{note.content}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(note.timestamp), 'MMM d, h:mm a')}
                    </p>
                  </div>
                ))}
                {editItem.notes.length === 0 && (
                  <p className="text-sm text-gray-500">No notes yet</p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                  placeholder="Add a note..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddNote}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center">
            {mode === 'edit' && (
              <button
                onClick={handleDelete}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {mode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};