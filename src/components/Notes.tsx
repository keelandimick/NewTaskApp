import React, { useState, useRef } from 'react';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { format } from 'date-fns';
import { processTextWithAI, renderTextWithLinks } from '../lib/ai';
import customChrono from '../lib/chronoConfig';

interface NotesProps {
  isOpen: boolean;
}

export const Notes: React.FC<NotesProps> = ({ isOpen }) => {
  const { selectedItemId, items, addNote, deleteNote, updateNote, updateItem, setCurrentView, setHighlightedItem, setSelectedItem } = useStoreWithAuth();
  const [noteInput, setNoteInput] = useState('');
  const [showOnHoldIndicator, setShowOnHoldIndicator] = useState(false);
  const [showOffHoldIndicator, setShowOffHoldIndicator] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isEditProcessing, setIsEditProcessing] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [previewDate, setPreviewDate] = useState<Date | null>(null);
  const [previewRecurrence, setPreviewRecurrence] = useState<string | null>(null);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find(item => item.id === selectedItemId);
  
  // Check if item has an active "on hold" note
  // Find the most recent ON HOLD or OFF HOLD note
  const holdNotes = selectedItem?.notes.filter(note => 
    note.content.toLowerCase().startsWith('on hold') || 
    note.content.toLowerCase() === 'off hold'
  ) || [];
  
  const mostRecentHoldNote = holdNotes.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  
  const onHoldNote = mostRecentHoldNote?.content.toLowerCase() === 'off hold' 
    ? null 
    : mostRecentHoldNote?.content.toLowerCase().startsWith('on hold') 
      ? mostRecentHoldNote 
      : null;
      
  const holdReason = onHoldNote ? 
    onHoldNote.content.replace(/^on hold[:\s-]*/i, '').trim() || 'No reason provided' : 
    null;

  const handleAddNote = async () => {
    if (!noteInput.trim() || !selectedItem) return;
    
    setIsProcessing(true);
    
    try {
      let processedNote = noteInput.trim();
      
      // Process note with AI for spell correction (unless it's an ON HOLD note)
      if (!processedNote.toLowerCase().startsWith('on hold') && processedNote.toLowerCase() !== 'off hold') {
        try {
          const processed = await processTextWithAI(processedNote);
          processedNote = processed.correctedText;
        } catch (error) {
          console.error('AI processing failed for note:', error);
        }
      }
      
      await addNote(selectedItem.id, processedNote);
      
      // If this is the first note being added to a task in the "start" column, move it to "in-progress"
      if (selectedItem.type === 'task' && selectedItem.status === 'start' && selectedItem.notes.length === 0) {
        await updateItem(selectedItem.id, { status: 'in-progress' });
      }
      
      setNoteInput('');
      setShowOnHoldIndicator(false);
      setShowOffHoldIndicator(false);
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Notes should always be shown when this component is rendered
  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col bg-yellow-50"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-200 bg-yellow-100">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Notes
        </h3>
        <span className="text-xs text-gray-500 font-medium">{selectedItem?.notes.length || 0}</span>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1">
        {selectedItem ? (
          <>
            {/* Selected item info */}
            <div className="px-3 py-2 bg-white border-b border-gray-200 shadow-sm">
              {isEditingTitle ? (
                <div>
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditingTitle(value);

                      // Only show preview if not dismissed
                      if (!previewDismissed) {
                        // Live preview of dates/recurrence
                        const recurringMatch = value.match(/\b(every\s+(other\s+)?\d*\s*(day|week|month|year|hours?|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)|daily|weekly|monthly|yearly|annually|weekdays?|weekends?)\b/i);
                        if (recurringMatch) {
                          // Format the recurring pattern nicely
                          let patternText = recurringMatch[0].toLowerCase();

                          // Expand day abbreviations
                          const dayMap: Record<string, string> = {
                            'mon': 'Monday', 'monday': 'Monday',
                            'tue': 'Tuesday', 'tuesday': 'Tuesday',
                            'wed': 'Wednesday', 'wednesday': 'Wednesday',
                            'thu': 'Thursday', 'thursday': 'Thursday',
                            'fri': 'Friday', 'friday': 'Friday',
                            'sat': 'Saturday', 'saturday': 'Saturday',
                            'sun': 'Sunday', 'sunday': 'Sunday'
                          };

                          // Replace abbreviated days with full names
                          Object.entries(dayMap).forEach(([abbr, full]) => {
                            const regex = new RegExp(`\\b${abbr}\\b`, 'i');
                            if (regex.test(patternText)) {
                              patternText = patternText.replace(regex, full);
                            }
                          });

                          // Capitalize first letter
                          let displayText = patternText.charAt(0).toUpperCase() + patternText.slice(1);

                          // Parse time (with or without AM/PM)
                          const timeMatch = value.match(/\b(at\s+)?(\d{1,2})(:\d{2})?\s*(am|pm|AM|PM)?\b/i);
                          if (timeMatch && timeMatch[2]) {
                            let hours = parseInt(timeMatch[2], 10);
                            const minutes = timeMatch[3] ? parseInt(timeMatch[3].slice(1), 10) : 0;

                            // Parse AM/PM or use smart defaults
                            if (timeMatch[4]) {
                              const isPM = timeMatch[4].toLowerCase() === 'pm';
                              if (isPM && hours !== 12) hours += 12;
                              if (!isPM && hours === 12) hours = 0;
                            } else if (hours >= 1 && hours <= 11) {
                              hours += 12; // Default to PM
                            }

                            // Format time nicely
                            const period = hours >= 12 ? 'PM' : 'AM';
                            const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
                            const formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;

                            displayText += ` at ${formattedTime}`;
                          }

                          setPreviewRecurrence(displayText);
                          setPreviewDate(null);
                        } else {
                          const parsedDate = customChrono.parseDate(value);
                          if (parsedDate) {
                            setPreviewDate(parsedDate);
                            setPreviewRecurrence(null);
                          } else {
                            setPreviewDate(null);
                            setPreviewRecurrence(null);
                          }
                        }
                      }
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!editingTitle.trim() || !selectedItem) return;

                        // Parse for dates and recurring patterns (only if not dismissed)
                        let finalTitle = editingTitle.trim();
                        let updates: any = { title: finalTitle };

                        // Skip date/time parsing if user dismissed the preview
                        if (!previewDismissed) {
                          // Check for recurring patterns first
                          const recurringMatch = editingTitle.match(/\b(every\s+(other\s+)?\d*\s*(day|week|month|year|hours?|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)|daily|weekly|monthly|yearly|annually|weekdays?|weekends?)\b/i);
                          if (recurringMatch) {
                          // Extract recurrence and clean title
                          finalTitle = editingTitle.replace(recurringMatch[0], '').trim();
                          if (finalTitle.length > 0) {
                            finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
                          }

                          // Determine frequency and time (matching edge function logic)
                          const matchText = recurringMatch[0].toLowerCase();
                          let frequency: string;
                          let interval = 1;

                          if (matchText.includes('hour')) {
                            frequency = 'hourly';
                            // Extract interval (e.g., "every 3 hours" -> 3)
                            const intervalMatch = matchText.match(/every\s+(\d+)\s+hours?/);
                            if (intervalMatch) {
                              interval = parseInt(intervalMatch[1], 10);
                            }
                          } else if (matchText.includes('day')) {
                            frequency = 'daily';
                          } else if (matchText.includes('week')) {
                            frequency = 'weekly';
                          } else if (matchText.includes('month')) {
                            frequency = 'monthly';
                          } else if (matchText.includes('year')) {
                            frequency = 'yearly';
                          } else {
                            frequency = 'weekly';
                          }

                          // Use 'within7' status for all recurring reminders (database only allows today/within7/7plus)
                          // Client-side filtering will show it in recurring tab based on recurrence field
                          updates.status = 'within7';

                          // Calculate time based on frequency
                          const now = new Date();
                          let time: string;

                          if (frequency === 'hourly') {
                            // For hourly: start from current time + interval
                            const nextOccurrence = new Date(now.getTime() + interval * 60 * 60 * 1000);
                            time = nextOccurrence.toTimeString().slice(0, 5); // HH:MM format
                            updates.reminderDate = nextOccurrence.toISOString();
                          } else {
                            // For daily/weekly/monthly/yearly: try to parse time from title
                            const timeMatch = editingTitle.match(/\b(at\s+)?(\d{1,2})(:\d{2})?\s*(am|pm|AM|PM)?\b/i);
                            if (timeMatch && timeMatch[2]) {
                              // Parse the time (e.g., "3 pm", "3:00pm", "3:30 PM", "3", "15")
                              let hours = parseInt(timeMatch[2], 10);
                              const minutes = timeMatch[3] ? parseInt(timeMatch[3].slice(1), 10) : 0;

                              // If AM/PM specified, use it. Otherwise infer based on hour
                              if (timeMatch[4]) {
                                const isPM = timeMatch[4].toLowerCase() === 'pm';
                                if (isPM && hours !== 12) hours += 12;
                                if (!isPM && hours === 12) hours = 0;
                              } else if (hours >= 1 && hours <= 11) {
                                // For hours 1-11, default to PM (more common for reminders)
                                hours += 12;
                              }
                              // Hours 12-23 stay as-is (already in 24-hour format)

                              time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

                              // Strip the time from the title (like reminders do)
                              finalTitle = finalTitle.replace(timeMatch[0], '').trim();
                              // Re-capitalize after stripping
                              if (finalTitle.length > 0) {
                                finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
                              }
                            } else {
                              // Default to current time if no time specified
                              time = now.toTimeString().slice(0, 5);
                            }
                            // Clear any existing reminder date (recurring replaces one-time reminder)
                            updates.reminderDate = null;
                          }

                          updates.title = finalTitle;
                          updates.type = 'reminder';
                          updates.recurrence = {
                            frequency,
                            time,
                            interval: frequency === 'hourly' ? interval : undefined,
                            originalText: recurringMatch[0]
                          };
                        } else {
                          // Check for single date
                          const parsedDate = customChrono.parseDate(editingTitle);
                          if (parsedDate) {
                            const parsedText = customChrono.parse(editingTitle)[0].text;
                            finalTitle = editingTitle.replace(parsedText, '').trim();
                            if (finalTitle.length > 0) {
                              finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
                            }
                            updates.title = finalTitle;
                            updates.type = 'reminder';
                            updates.reminderDate = parsedDate;
                            // Calculate status
                            const now = new Date();
                            const reminderDateOnly = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
                            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            const diffTime = reminderDateOnly.getTime() - todayStart.getTime();
                            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                            if (diffDays < 0) {
                              updates.status = 'today';
                            } else if (diffDays === 0) {
                              updates.status = 'today';
                            } else if (diffDays <= 7) {
                              updates.status = 'within7';
                            } else {
                              updates.status = '7plus';
                            }
                          } else {
                            // No date detected - clear recurrence and reminder date (convert to task)
                            updates.recurrence = null;
                            updates.reminderDate = null;
                            updates.type = 'task';
                            updates.status = 'start';
                          }
                        }
                        }

                        // Capitalize first letter
                        if (finalTitle.length > 0) {
                          finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
                          updates.title = finalTitle;
                        }

                        // Check for duplicates
                        const normalizedTitle = finalTitle.toLowerCase();
                        const duplicateExists = items.some(otherItem =>
                          !otherItem.deletedAt &&
                          otherItem.status !== 'complete' &&
                          otherItem.title.toLowerCase() === normalizedTitle &&
                          otherItem.id !== selectedItem.id
                        );

                        if (duplicateExists) {
                          alert('A task with this title already exists');
                          setIsEditingTitle(false);
                          setEditingTitle('');
                          setPreviewDate(null);
                          setPreviewRecurrence(null);
                          setPreviewDismissed(false);
                          return;
                        }

                        try {
                          await updateItem(selectedItem.id, updates);
                          setIsEditingTitle(false);
                          setEditingTitle('');
                          setPreviewDate(null);
                          setPreviewRecurrence(null);
                          setPreviewDismissed(false);

                          // Navigate to appropriate view if type/category changed
                          const typeChanged = updates.type && updates.type !== selectedItem.type;
                          const addedRecurrence = updates.recurrence && !selectedItem.recurrence;
                          const clearedRecurrence = updates.recurrence === null && selectedItem.recurrence;
                          const addedReminderDate = 'reminderDate' in updates && updates.reminderDate && !('reminderDate' in selectedItem && selectedItem.reminderDate);
                          const clearedReminderDate = 'reminderDate' in updates && updates.reminderDate === null && ('reminderDate' in selectedItem && selectedItem.reminderDate);
                          const listChanged = updates.listId && updates.listId !== selectedItem.listId;

                          // Trigger navigation for ANY conversion: task↔reminder, task↔recurring, reminder↔recurring
                          if (typeChanged || addedRecurrence || clearedRecurrence || addedReminderDate || clearedReminderDate || listChanged) {
                            // Determine target view based on what the item will become
                            let targetView: 'tasks' | 'reminders' | 'recurring' | 'complete' | 'trash';

                            // Priority: recurring > reminder > task
                            if (updates.recurrence || (selectedItem.recurrence && !clearedRecurrence)) {
                              // Has recurrence (or keeping existing recurrence) → recurring tab
                              targetView = 'recurring';
                            } else if (updates.reminderDate || (('reminderDate' in selectedItem && selectedItem.reminderDate) && !clearedReminderDate)) {
                              // Has reminder date (or keeping existing date) and no recurrence → reminders tab
                              targetView = 'reminders';
                            } else {
                              // No recurrence and no reminder date → tasks tab
                              targetView = 'tasks';
                            }

                            // Navigate instantly
                            setCurrentView(targetView);
                            // Highlight after view renders
                            setTimeout(() => setHighlightedItem(selectedItem.id), 50);
                            // Close Notes after you see the navigation
                            setTimeout(() => setSelectedItem(null), 100);
                          }
                        } catch (error) {
                          console.error('Failed to update title:', error);
                        }
                      } else if (e.key === 'Escape') {
                        // First ESC: Dismiss date/time preview only
                        if (previewDate || previewRecurrence) {
                          setPreviewDate(null);
                          setPreviewRecurrence(null);
                          setPreviewDismissed(true); // Mark as dismissed for this edit session
                        } else {
                          // Second ESC: Close editing entirely
                          setIsEditingTitle(false);
                          setEditingTitle('');
                          setPreviewDismissed(false);
                        }
                      }
                    }}
                    onBlur={() => {
                      setIsEditingTitle(false);
                      setEditingTitle('');
                      setPreviewDate(null);
                      setPreviewRecurrence(null);
                      setPreviewDismissed(false);
                    }}
                    autoFocus
                    className="w-full px-2 py-1 text-sm font-medium text-gray-900 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Live preview */}
                  {previewDate && (() => {
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const reminderDateOnly = new Date(previewDate.getFullYear(), previewDate.getMonth(), previewDate.getDate());

                    return (
                      <div className="text-[11px] text-blue-500 flex items-center gap-1 mt-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>
                          {reminderDateOnly.getTime() === today.getTime()
                            ? 'Today'
                            : reminderDateOnly.getTime() === tomorrow.getTime()
                            ? 'Tomorrow'
                            : format(previewDate, 'MMM d, yyyy')}
                          {' at ' + format(previewDate, 'h:mm a')}
                        </span>
                      </div>
                    );
                  })()}

                  {previewRecurrence && (
                    <div className="text-[11px] text-blue-500 flex items-center gap-1 mt-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Recurring: {previewRecurrence}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div
                    className="flex items-center gap-2 group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                    onClick={() => {
                      setIsEditingTitle(true);
                      setEditingTitle(selectedItem.title);
                      setPreviewDismissed(false); // Reset for new edit session
                    }}
                  >
                    <span className="text-sm font-medium text-gray-900 flex-1">
                      {selectedItem.title}
                    </span>
                    <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>

                  {/* Date/time info with clear button */}
                  {(selectedItem.type === 'reminder' && selectedItem.reminderDate) && (
                    <div className="px-2 py-1 flex items-center justify-between text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{format(new Date(selectedItem.reminderDate), 'MMM d, yyyy \'at\' h:mm a')}</span>
                      </div>
                      <button
                        onClick={async () => {
                          if (window.confirm('Clear date and time? This will convert the item to a regular task.')) {
                            try {
                              await updateItem(selectedItem.id, {
                                type: 'task',
                                status: 'start',
                                reminderDate: null,
                                recurrence: null
                              } as any);
                              // Navigate instantly
                              setCurrentView('tasks');
                              // Highlight after view renders
                              setTimeout(() => setHighlightedItem(selectedItem.id), 50);
                              // Close Notes after you see the navigation
                              setTimeout(() => setSelectedItem(null), 100);
                            } catch (error) {
                              console.error('Failed to clear date:', error);
                            }
                          }
                        }}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Clear date and time"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {selectedItem.recurrence && (
                    <div className="px-2 py-1 flex items-center justify-between text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>
                          {(() => {
                            // For interval-based recurrences (minutely/hourly), use reminderDate for accurate local time
                            const timeDisplay = (selectedItem.recurrence.frequency === 'minutely' || selectedItem.recurrence.frequency === 'hourly') && selectedItem.type === 'reminder' && selectedItem.reminderDate
                              ? format(selectedItem.reminderDate, 'h:mm a')
                              : format(new Date(`2000-01-01T${selectedItem.recurrence.time}`), 'h:mm a');

                            return selectedItem.recurrence.originalText
                              ? `${selectedItem.recurrence.originalText} at ${timeDisplay}`
                              : `${selectedItem.recurrence.frequency} at ${timeDisplay}`;
                          })()}
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          if (window.confirm('Clear recurrence? This will convert the item to a regular task.')) {
                            try {
                              await updateItem(selectedItem.id, {
                                type: 'task',
                                status: 'start',
                                reminderDate: null,
                                recurrence: null
                              } as any);
                              // Navigate instantly
                              setCurrentView('tasks');
                              // Highlight after view renders
                              setTimeout(() => setHighlightedItem(selectedItem.id), 50);
                              // Close Notes after you see the navigation
                              setTimeout(() => setSelectedItem(null), 100);
                            } catch (error) {
                              console.error('Failed to clear recurrence:', error);
                            }
                          }
                        }}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Clear recurrence"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {selectedItem.notes.length > 0 ? (
                <div className="space-y-3">
                  {selectedItem.notes.sort((a, b) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                  ).map((note) => {
                    const isOnHoldNote = note.content.toLowerCase().startsWith('on hold') || note.content.toLowerCase() === 'off hold';
                    const noteContent = isOnHoldNote ? note.content : renderTextWithLinks(note.content);
                    
                    return (
                      <div key={note.id} className="text-sm group">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 bg-white rounded-lg p-3 shadow-sm border border-gray-100 relative">
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {editingNoteId !== note.id && (
                                <button
                                  onClick={() => {
                                    setEditingNoteId(note.id);
                                    setEditingContent(note.content);
                                  }}
                                  className="text-gray-400 hover:text-blue-600"
                                  title="Edit note"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  if (window.confirm(isOnHoldNote && note.content.toLowerCase() !== 'off hold' 
                                    ? 'Delete this ON HOLD status?' 
                                    : 'Delete this note?')) {
                                    try {
                                      if (selectedItemId) {
                                        await deleteNote(selectedItemId, note.id);
                                      }
                                    } catch (error) {
                                      console.error('Failed to delete note:', error);
                                    }
                                  }
                                }}
                                className="text-gray-400 hover:text-red-600"
                                title="Delete note"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                            
                            {editingNoteId === note.id ? (
                              <div>
                                <textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  ref={(textarea) => {
                                    if (textarea) {
                                      textarea.focus();
                                      // Move cursor to end
                                      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                                    }
                                  }}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      if (editingContent.trim() && selectedItemId && !isEditProcessing) {
                                        setIsEditProcessing(true);
                                        try {
                                          const processedContent = editingContent.trim();
                                          
                                          // Skip AI processing for edits
                                          await updateNote(selectedItemId, note.id, processedContent);
                                          // Only clear the edit state after successful update
                                          setEditingNoteId(null);
                                          setEditingContent('');
                                        } catch (error) {
                                          console.error('Failed to update note:', error);
                                          alert('Failed to update note. Please try again.');
                                        } finally {
                                          setIsEditProcessing(false);
                                        }
                                      }
                                    } else if (e.key === 'Escape') {
                                      setEditingNoteId(null);
                                      setEditingContent('');
                                    }
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                  rows={3}
                                  autoFocus
                                />
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={async () => {
                                      if (editingContent.trim() && selectedItemId && !isEditProcessing) {
                                        setIsEditProcessing(true);
                                        try {
                                          const processedContent = editingContent.trim();
                                          
                                          // Skip AI processing for edits
                                          await updateNote(selectedItemId, note.id, processedContent);
                                          // Only clear the edit state after successful update
                                          setEditingNoteId(null);
                                          setEditingContent('');
                                        } catch (error) {
                                          console.error('Failed to update note:', error);
                                          alert('Failed to update note. Please try again.');
                                        } finally {
                                          setIsEditProcessing(false);
                                        }
                                      }
                                    }}
                                    disabled={isEditProcessing || !editingContent.trim()}
                                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                  >
                                    {isEditProcessing ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingNoteId(null);
                                      setEditingContent('');
                                    }}
                                    className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {isOnHoldNote && note.content.toLowerCase() !== 'off hold' ? (
                                  <div className="pr-14">
                                    <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                      ON HOLD
                                    </span>
                                    <span className="text-gray-700 ml-2">
                                      {note.content.replace(/^on hold[:\s-]*/i, '').trim() || 'No reason provided'}
                                    </span>
                                  </div>
                                ) : isOnHoldNote && note.content.toLowerCase() === 'off hold' ? (
                                  <p className="text-gray-700 font-medium pr-14">
                                    <span className="text-green-600">✅ </span>
                                    {noteContent}
                                  </p>
                                ) : (
                                  <p className="text-gray-700 pr-14">{noteContent}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                  {format(new Date(note.timestamp), 'MMM d, h:mm a')}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No notes yet. Add one below.</p>
              )}
            </div>

            {/* Note input */}
            <div className="px-3 py-3 border-t border-gray-300 bg-white">
              <form onSubmit={(e) => { e.preventDefault(); handleAddNote(); }} className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 bg-gray-50">
                  {showOnHoldIndicator && (
                    <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded whitespace-nowrap">
                      ON HOLD
                    </span>
                  )}
                  {showOffHoldIndicator && (
                    <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded whitespace-nowrap">
                      OFF HOLD
                    </span>
                  )}
                  <input
                    type="text"
                    value={showOnHoldIndicator ? noteInput.replace(/^on hold\s*/i, '') : showOffHoldIndicator ? '' : noteInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (showOnHoldIndicator) {
                        setNoteInput('on hold ' + value);
                      } else if (showOffHoldIndicator) {
                        // OFF HOLD is complete, don't allow editing
                        setNoteInput('off hold');
                      } else {
                        setNoteInput(value);
                        if (value.toLowerCase() === 'on hold') {
                          setShowOnHoldIndicator(true);
                          setNoteInput('on hold ');
                        } else if (value.toLowerCase() === 'off hold') {
                          setShowOffHoldIndicator(true);
                          setNoteInput('off hold');
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      // Handle backspace when at the beginning with ON HOLD tag
                      if (e.key === 'Backspace' && showOnHoldIndicator && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
                        e.preventDefault();
                        setNoteInput('');
                        setShowOnHoldIndicator(false);
                      }
                      // Handle backspace for OFF HOLD tag
                      if (e.key === 'Backspace' && showOffHoldIndicator) {
                        e.preventDefault();
                        setNoteInput('');
                        setShowOffHoldIndicator(false);
                      }
                      // Handle escape to remove ON HOLD tag
                      if (e.key === 'Escape' && showOnHoldIndicator) {
                        e.preventDefault();
                        setNoteInput('');
                        setShowOnHoldIndicator(false);
                      }
                      // Handle escape to remove OFF HOLD tag
                      if (e.key === 'Escape' && showOffHoldIndicator) {
                        e.preventDefault();
                        setNoteInput('');
                        setShowOffHoldIndicator(false);
                      }
                    }}
                    placeholder={showOnHoldIndicator ? "reason for on hold" : showOffHoldIndicator ? "Press Enter to submit" : 'Add a note... (Try "on hold" or "off hold")'}
                    disabled={isProcessing}
                    className="flex-1 bg-transparent border-none outline-none focus:outline-none p-0 disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!noteInput.trim() || isProcessing}
                  className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    'Add'
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center px-3">
            <p className="text-gray-500 text-center text-sm">
              Select an item to view and add notes
            </p>
          </div>
        )}
      </div>
    </div>
  );
};