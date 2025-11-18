import React, { useState, useEffect } from 'react';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { Priority, RecurrenceFrequency, ViewMode, Item } from '../types';
import { format } from 'date-fns';
import customChrono from '../lib/chronoConfig';
import { processTextWithAI } from '../lib/ai';

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
    items,
    currentListId, 
    currentView, 
    setCurrentView, 
    setHighlightedItem,
    lists,
    setCurrentList 
  } = useStoreWithAuth();

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('low');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('daily');
  const [noteInput, setNoteInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [naturalDateInput, setNaturalDateInput] = useState('');

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
      setNaturalDateInput('');
    } else if (mode === 'edit' && editItem) {
      setTitle(editItem.title);
      setPriority(editItem.priority);
      
      if (editItem.type === 'reminder' && editItem.reminderDate) {
        const date = new Date(editItem.reminderDate);
        setDueDate(format(date, 'yyyy-MM-dd'));
        setDueTime(format(date, 'HH:mm'));
        // Don't set naturalDateInput for edit mode
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
    
    // Check for duplicates (case insensitive) in active items only
    const normalizedTitle = title.trim().toLowerCase();
    const duplicateExists = items.some(item => 
      !item.deletedAt && 
      item.status !== 'complete' &&
      item.title.toLowerCase() === normalizedTitle &&
      (mode === 'create' || item.id !== editItem?.id) // Don't check against self when editing
    );
    
    if (duplicateExists) {
      alert('A task with this title already exists');
      return;
    }
    
    setIsProcessing(true);

    // Try to extract date and recurring patterns from title if no date is set
    let extractedTitle = title.trim();
    let extractedDate: Date | undefined;
    let detectedRecurrence: { frequency: RecurrenceFrequency; time: string; originalText?: string } | undefined;
    
    // First, check for dates and recurring patterns
    if (!dueDate && !isRecurring) {
      // Check for recurring patterns first
      const recurringPatterns = [
        { pattern: /\b(every\s+day|daily)\b/i, frequency: 'daily' as RecurrenceFrequency },
        { pattern: /\b(every\s+week|weekly)\b/i, frequency: 'weekly' as RecurrenceFrequency },
        { pattern: /\b(every\s+month|monthly)\b/i, frequency: 'monthly' as RecurrenceFrequency },
        { pattern: /\b(every\s+year|yearly|annually)\b/i, frequency: 'yearly' as RecurrenceFrequency },
        { pattern: /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, frequency: 'weekly' as RecurrenceFrequency },
        // Additional patterns - best effort basis
        { pattern: /\bevery\s+\d+\s+hours?\b/i, frequency: 'daily' as RecurrenceFrequency }, // "every 3 hours" -> daily
        { pattern: /\bevery\s+(other|2nd|second)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, frequency: 'weekly' as RecurrenceFrequency }, // "every other tuesday" -> weekly
        { pattern: /\b(weekdays|every\s+weekday)\b/i, frequency: 'daily' as RecurrenceFrequency }, // "weekdays" -> daily
        { pattern: /\b(weekends|every\s+weekend)\b/i, frequency: 'weekly' as RecurrenceFrequency } // "weekends" -> weekly
      ];

      for (const { pattern, frequency } of recurringPatterns) {
        const match = title.match(pattern);
        if (match) {
          detectedRecurrence = { 
            frequency, 
            time: '09:00',
            originalText: match[0] // Store the original pattern text
          };
          extractedTitle = title.replace(match[0], '').trim();
          // Re-capitalize if needed after removing recurring pattern
          if (extractedTitle.length > 0) {
            extractedTitle = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1);
          }
          
          // Try to parse time from the title
          const timeMatch = title.match(/\b(at\s+)?(\d{1,2}(:\d{2})?\s*(am|pm)?|\d{1,2}:\d{2})\b/i);
          if (timeMatch && detectedRecurrence) {
            const parsedTime = customChrono.parseDate(timeMatch[0]);
            if (parsedTime) {
              detectedRecurrence.time = format(parsedTime, 'HH:mm');
            }
          }
          break;
        }
      }

      // If no recurring pattern found, try to extract a single date
      if (!detectedRecurrence) {
        const parsedFromTitle = customChrono.parse(title.trim());
        if (parsedFromTitle.length > 0) {
          extractedDate = parsedFromTitle[0].start.date();
          // Remove the date text from the title
          extractedTitle = title.replace(parsedFromTitle[0].text, '').trim();
          // Re-capitalize if needed after removing date text
          if (extractedTitle.length > 0) {
            extractedTitle = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1);
          }
        }
      }
    }

    // Now process the cleaned title with AI for spell correction and proper noun capitalization
    let aiSuggestedListId: string | undefined;
    try {
      const processed = await processTextWithAI(extractedTitle, lists.map(l => ({ id: l.id, name: l.name })));
      extractedTitle = processed.correctedText;
      aiSuggestedListId = processed.suggestedListId;
    } catch (error) {
      console.error('AI processing failed, using original text:', error);
      // Fallback: just capitalize first letter
      if (extractedTitle.length > 0) {
        extractedTitle = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1);
      }
    }

    const hasDate = dueDate || isRecurring || extractedDate || detectedRecurrence;
    const itemType = hasDate ? 'reminder' : 'task';

    let reminderDate: Date | undefined;
    if (dueDate) {
      reminderDate = new Date(`${dueDate}T${dueTime || '09:00'}`);
    } else if (extractedDate && !detectedRecurrence) {
      reminderDate = extractedDate;
    }

    const recurrence = isRecurring ? {
      frequency: recurrenceFrequency,
      time: dueTime || '09:00',
    } : detectedRecurrence ? {
      frequency: detectedRecurrence.frequency,
      time: detectedRecurrence.time,
      originalText: detectedRecurrence.originalText
    } : undefined;

    if (mode === 'create') {
      try {
        // Use AI-suggested list if available, otherwise use current selection
        let targetListId: string;
        if (aiSuggestedListId) {
          // Always prefer AI suggestion when available
          targetListId = aiSuggestedListId;
        } else if (currentListId === 'all') {
          // If on "All" view with no AI suggestion, use first list
          targetListId = lists[0]?.id;
        } else {
          // Otherwise use the currently selected list
          targetListId = currentListId;
        }

        const newItemId = await addItem({
          type: itemType,
          title: extractedTitle,
          priority,
          status: itemType === 'task' ? (defaultColumn as any || 'start') : 'within7',
          listId: targetListId,
          reminderDate,
          recurrence,
        } as any);

        // Navigation logic - simplified and complete
        // 1. Determine target view based on item type
        let targetView: ViewMode;
        if (recurrence) {
          targetView = 'recurring';
        } else if (reminderDate) {
          targetView = 'reminders';
        } else {
          targetView = 'tasks';
        }

        // 2. Switch to the target list if it's different from current
        if (currentListId !== targetListId) {
          setCurrentList(targetListId);
        }

        // 3. Navigate to the appropriate view
        if (targetView !== currentView) {
          setCurrentView(targetView);
        }
        
        // 4. Highlight the new item
        setHighlightedItem(newItemId);
      } catch (error) {
        console.error('Failed to add item:', error);
        setIsProcessing(false);
        return;
      }
    } else if (mode === 'edit' && editItem) {
      try {
        // Update existing item
        await updateItem(editItem.id, {
          title: extractedTitle,
          priority,
          reminderDate,
          recurrence,
          type: itemType,
        });

        // Navigation logic for edits - simplified
        // 1. Determine target view based on updated item type
        let targetView: ViewMode;
        if (recurrence) {
          targetView = 'recurring';
        } else if (reminderDate) {
          targetView = 'reminders';
        } else {
          targetView = 'tasks';
        }

        // 2. Navigate to the appropriate view if item type changed
        if (targetView !== currentView && currentView !== 'trash') {
          setCurrentView(targetView);
        }
        
        // 3. Highlight the edited item
        setHighlightedItem(editItem.id);
      } catch (error) {
        console.error('Failed to update item:', error);
        setIsProcessing(false);
        return;
      }
    }

    setIsProcessing(false);
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
              spellCheck="true"
            />
            {mode === 'create' && !dueDate && !isRecurring && (() => {
              // Check for recurring patterns
              const recurringMatch = title.match(/\b(every\s+(day|week|month|year|\d+\s+hours?|other\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly|monthly|yearly|annually|weekdays?|weekends?)\b/i);
              if (recurringMatch) {
                return (
                  <div className="text-xs text-gray-500 mt-1">
                    Recurring pattern detected: {recurringMatch[0]}
                  </div>
                );
              }
              
              // Check for single date
              const parsed = customChrono.parse(title);
              if (parsed.length > 0) {
                return (
                  <div className="text-xs text-gray-500 mt-1">
                    Date detected: {format(parsed[0].start.date(), 'MMM d, yyyy h:mm a')}
                  </div>
                );
              }
              return null;
            })()}
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

          {/* Due Date/Time - Only show in edit mode */}
          {mode === 'edit' && (
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Due Date & Time</label>
              <div className="space-y-2">
                {/* Natural language input */}
                <input
                  type="text"
                  value={naturalDateInput}
                  onChange={(e) => {
                    setNaturalDateInput(e.target.value);
                    // Parse the input
                    const parsed = customChrono.parseDate(e.target.value);
                    if (parsed) {
                      setDueDate(format(parsed, 'yyyy-MM-dd'));
                      setDueTime(format(parsed, 'HH:mm'));
                    }
                  }}
                  placeholder="e.g. tomorrow at 3pm, next Monday, in 2 hours"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {naturalDateInput && customChrono.parseDate(naturalDateInput) && (
                  <div className="text-xs text-gray-500">
                    Understood as: {format(customChrono.parseDate(naturalDateInput)!, 'MMM d, yyyy h:mm a')}
                  </div>
                )}
                {/* Manual date/time inputs with clear button */}
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      setNaturalDateInput(''); // Clear natural language when manual input is used
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => {
                      setDueTime(e.target.value);
                      setNaturalDateInput(''); // Clear natural language when manual input is used
                    }}
                    placeholder="09:00"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDueDate('');
                      setDueTime('');
                      setNaturalDateInput('');
                    }}
                    className="px-3 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recurrence - Only show in edit mode */}
          {mode === 'edit' && (
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
          )}

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
                  spellCheck="true"
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
                disabled={isProcessing}
                className={`px-4 py-2 transition-colors ${
                  isProcessing
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 ${
                  isProcessing 
                    ? 'bg-blue-500 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isProcessing && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isProcessing ? 'Processing...' : (mode === 'create' ? 'Create' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};