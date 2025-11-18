import React, { useState, useRef } from 'react';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { format } from 'date-fns';
import { processTextWithAI, renderTextWithLinks } from '../lib/ai';

interface NotesProps {
  isOpen: boolean;
}

export const Notes: React.FC<NotesProps> = ({ isOpen }) => {
  const { selectedItemId, items, addNote, deleteNote, updateNote, updateItem } = useStoreWithAuth();
  const [noteInput, setNoteInput] = useState('');
  const [showOnHoldIndicator, setShowOnHoldIndicator] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isEditProcessing, setIsEditProcessing] = useState(false);
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
              <div className="text-sm font-medium text-gray-900">{selectedItem.title}</div>
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {selectedItem.notes.length > 0 ? (
                <div className="space-y-3">
                  {selectedItem.notes.sort((a, b) => 
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                  ).map((note, index) => {
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
                  <input
                    type="text"
                    value={showOnHoldIndicator ? noteInput.replace(/^on hold\s*/i, '') : noteInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (showOnHoldIndicator) {
                        setNoteInput('on hold ' + value);
                      } else {
                        setNoteInput(value);
                        if (value.toLowerCase() === 'on hold') {
                          setShowOnHoldIndicator(true);
                          setNoteInput('on hold ');
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
                      // Handle escape to remove ON HOLD tag
                      if (e.key === 'Escape' && showOnHoldIndicator) {
                        e.preventDefault();
                        setNoteInput('');
                        setShowOnHoldIndicator(false);
                      }
                    }}
                    placeholder={showOnHoldIndicator ? "reason for on hold" : 'Add a note... (Try typing "on hold")'}
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