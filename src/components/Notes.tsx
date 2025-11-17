import React, { useState, useRef, useEffect } from 'react';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { format } from 'date-fns';
import { processTextWithAI, renderTextWithLinks } from '../lib/ai';

interface NotesProps {
  isOpen: boolean;
  onToggle: () => void;
  height: number;
  onHeightChange: (height: number) => void;
}

export const Notes: React.FC<NotesProps> = ({ isOpen, onToggle, height, onHeightChange }) => {
  const { selectedItemId, items, addNote, updateItem } = useStoreWithAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [showOnHoldIndicator, setShowOnHoldIndicator] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

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
      
  const onHoldReason = onHoldNote ? 
    onHoldNote.content.replace(/^on hold[:\s-]*/i, '').trim() || 'No reason provided' : 
    null;

  // Handle drag to resize
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaY = startYRef.current - e.clientY;
      const newHeight = Math.max(100, Math.min(500, startHeightRef.current + deltaY));
      onHeightChange(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onHeightChange]);

  const handleAddNote = async () => {
    if (!noteInput.trim() || !selectedItem) return;
    
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
      
      // If this is the first note being added to a task in the "start" column, move it to "waiting" (In Progress)
      if (selectedItem.type === 'task' && selectedItem.status === 'start' && selectedItem.notes.length === 0) {
        await updateItem(selectedItem.id, { status: 'waiting' });
      }
      
      setNoteInput('');
      setShowOnHoldIndicator(false);
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-0 left-64 right-0 bg-gray-100 border-t border-gray-300 px-6 py-2 text-sm text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        Notes {selectedItem ? `for "${selectedItem.title}"` : '(select an item)'}
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-300 shadow-lg"
      style={{ height: `${height}px` }}
    >
      {/* Drag handle */}
      <div
        className="absolute top-0 left-0 right-0 h-1 bg-gray-300 hover:bg-gray-400 cursor-ns-resize"
        onMouseDown={handleMouseDown}
      />
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">
          {selectedItem ? `Notes for "${selectedItem.title}"` : 'Notes'}
        </h3>
        <button
          onClick={onToggle}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col" style={{ height: `calc(${height}px - 60px)` }}>
        {selectedItem ? (
          <>
            {/* Notes list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              {/* On Hold Status Display */}
              {onHoldNote && (
                <div className="mb-4 bg-red-100 border border-red-400 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-700 mb-2">{onHoldReason}</p>
                      <p className="text-lg font-bold text-red-600">ON HOLD</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await addNote(selectedItem.id, `OFF HOLD`);
                          // Force a re-render by clearing and resetting the note input
                          setNoteInput('');
                        } catch (error) {
                          console.error('Failed to remove on hold status:', error);
                        }
                      }}
                      className="text-red-600 hover:text-red-800"
                      title="Remove ON HOLD status"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              
              {selectedItem.notes.length === 0 ? (
                <p className="text-gray-500 text-sm">No notes yet. Add one below!</p>
              ) : (
                <div className="space-y-3">
                  {selectedItem.notes
                    .filter(note => {
                      // Hide ON HOLD and OFF HOLD notes since they're system notes
                      const isOnHold = note.content.toLowerCase().startsWith('on hold');
                      const isOffHold = note.content.toLowerCase() === 'off hold';
                      return !isOnHold && !isOffHold;
                    })
                    .map((note) => (
                    <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-800">{renderTextWithLinks(note.content)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(note.timestamp), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add note input */}
            <div className="px-6 py-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  {showOnHoldIndicator ? (
                    <div className="flex items-center gap-2 px-3 py-2 border border-red-400 rounded-lg">
                      <span 
                        className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded cursor-pointer" 
                        onClick={() => {
                          setNoteInput('');
                          setShowOnHoldIndicator(false);
                        }}
                        title="Click to cancel ON HOLD"
                      >
                        ON HOLD
                      </span>
                      <input
                        type="text"
                        value={noteInput.replace(/^on hold[\s:-]*/i, '')}
                        onChange={(e) => {
                          setNoteInput('on hold: ' + e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddNote();
                          } else if (e.key === 'Escape' || (e.key === 'Backspace' && e.currentTarget.value === '')) {
                            setNoteInput('');
                            setShowOnHoldIndicator(false);
                          }
                        }}
                        placeholder="reason (optional)..."
                        className="flex-1 outline-none bg-transparent"
                        autoFocus
                        spellCheck="true"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={noteInput}
                      onChange={(e) => {
                        setNoteInput(e.target.value);
                        // Check if input starts with "on hold"
                        setShowOnHoldIndicator(e.target.value.toLowerCase().startsWith('on hold'));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNote();
                        }
                      }}
                      placeholder="Add a note... (try 'on hold' to pause a task)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      spellCheck="true"
                    />
                  )}
                </div>
                <button
                  onClick={() => {
                    handleAddNote();
                    setShowOnHoldIndicator(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>Select an item to view and add notes</p>
          </div>
        )}
      </div>
    </div>
  );
};