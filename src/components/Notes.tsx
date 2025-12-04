import React, { useState, useRef, useEffect } from 'react';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { format } from 'date-fns';
import { processTextWithAI, renderTextWithLinks } from '../lib/ai';
import { formatRecurrence } from '../lib/formatRecurrence';
import { Attachment } from '../types';

interface NotesProps {
  isOpen: boolean;
  onDeleteItem?: () => void;
  readOnly?: boolean;
  onRestore?: (itemId: string) => void;
}

export const Notes: React.FC<NotesProps> = ({ isOpen, onDeleteItem, readOnly = false, onRestore }) => {
  const { selectedItemId, items, addNote, deleteNote, updateNote, updateItem, addAttachment, deleteAttachment, getAttachmentUrl } = useStoreWithAuth();
  const [isRestoring, setIsRestoring] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [showOnHoldTag, setShowOnHoldTag] = useState(false);
  const [showOffHoldTag, setShowOffHoldTag] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isEditProcessing, setIsEditProcessing] = useState(false);

  // Attachment state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const reasonInputRef = useRef<HTMLInputElement>(null);
  const offHoldContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when Notes panel opens
  useEffect(() => {
    if (isOpen && inputRef.current && !showOnHoldTag && !showOffHoldTag) {
      // Small delay to ensure the panel is fully rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, selectedItemId, showOnHoldTag, showOffHoldTag]);

  // Auto-focus OFF HOLD container when it appears
  useEffect(() => {
    if (showOffHoldTag && offHoldContainerRef.current) {
      offHoldContainerRef.current.focus();
    }
  }, [showOffHoldTag]);

  const selectedItem = items.find(item => item.id === selectedItemId);

  // Check if item has an active "on hold" status in metadata
  const onHoldData = selectedItem?.metadata?.onHold as { reason?: string } | undefined;
  const isOnHold = !!onHoldData;
  const onHoldReason = isOnHold ? (onHoldData?.reason || 'No reason provided') : null;

  const handleAddNote = async () => {
    if (!selectedItem || isProcessing) return;

    // For OFF HOLD, clear the hold status
    if (showOffHoldTag) {
      setIsProcessing(true);
      try {
        const newMetadata = { ...(selectedItem.metadata || {}), onHold: undefined };
        await updateItem(selectedItem.id, { metadata: newMetadata });
        setNoteInput('');
        setShowOffHoldTag(false);
      } catch (error) {
        console.error('Failed to clear hold status:', error);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // For ON HOLD, set the hold status in metadata
    if (showOnHoldTag) {
      setIsProcessing(true);
      const reason = holdReason.trim();
      try {
        const newMetadata = {
          ...(selectedItem.metadata || {}),
          onHold: reason ? { reason } : {}
        };
        await updateItem(selectedItem.id, { metadata: newMetadata });
        setNoteInput('');
        setShowOnHoldTag(false);
        setHoldReason('');
      } catch (error) {
        console.error('Failed to set hold status:', error);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Regular note
    if (!noteInput.trim()) return;

    setIsProcessing(true);
    let processedNote = noteInput.trim();

    try {
      // Process note with AI for spell correction
      const aiResult = await processTextWithAI(processedNote);
      processedNote = aiResult.correctedText || processedNote;

      await addNote(selectedItem.id, processedNote);
      setNoteInput('');
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editingContent.trim() || !selectedItem || isEditProcessing) return;

    setIsEditProcessing(true);
    let processedContent = editingContent.trim();

    try {
      // Process note with AI for spell correction (unless it's an ON HOLD note)
      if (!processedContent.toLowerCase().startsWith('on hold') && processedContent.toLowerCase() !== 'off hold') {
        const aiResult = await processTextWithAI(processedContent);
        processedContent = aiResult.correctedText || processedContent;
      }

      await updateNote(selectedItem.id, noteId, processedContent);
      setEditingNoteId(null);
      setEditingContent('');
    } catch (error) {
      console.error('Failed to update note:', error);
    } finally {
      setIsEditProcessing(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedItem) return;

    if (window.confirm('Delete this note?')) {
      await deleteNote(selectedItem.id, noteId);
    }
  };

  // Detect when user types "on hold" or "off hold" to show tags
  useEffect(() => {
    const lower = noteInput.toLowerCase().trim();

    // When user types exactly "on hold", convert to tag mode
    if (lower === 'on hold' && !showOnHoldTag) {
      setShowOnHoldTag(true);
      setNoteInput('');
      // Focus the reason input after state updates
      setTimeout(() => reasonInputRef.current?.focus(), 0);
    }

    // When user types exactly "off hold", convert to tag mode
    if (lower === 'off hold' && !showOffHoldTag) {
      setShowOffHoldTag(true);
      setNoteInput('');
    }
  }, [noteInput, showOnHoldTag, showOffHoldTag]);

  // Attachment handlers
  const handleFileUpload = async (file: File) => {
    if (!selectedItem) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10MB.');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('Only images and PDFs are supported.');
      return;
    }

    setIsUploadingAttachment(true);
    try {
      await addAttachment(selectedItem.id, file);
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attachment: Attachment) => {
    if (!selectedItem) return;

    if (window.confirm(`Delete "${attachment.fileName}"?`)) {
      try {
        await deleteAttachment(selectedItem.id, attachment.id, attachment.filePath);
      } catch (error) {
        console.error('Failed to delete attachment:', error);
        alert('Failed to delete attachment. Please try again.');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await handleFileUpload(file);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col bg-yellow-50 ${isDragging ? 'ring-2 ring-blue-400 ring-inset bg-blue-50' : ''}`}
      onClick={(e) => e.stopPropagation()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
            {/* Selected item info (read-only) */}
            <div className="px-3 py-2 bg-white border-b border-gray-200 shadow-sm">
              <div className="px-2 py-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-gray-900 flex-1">
                    {selectedItem.title}
                  </div>
                  {/* Restore button - only show in read-only mode (completed items) */}
                  {readOnly && onRestore && (
                    <button
                      onClick={() => {
                        if (!selectedItem || isRestoring) return;
                        setIsRestoring(true);
                        onRestore(selectedItem.id);
                      }}
                      disabled={isRestoring}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors disabled:opacity-50"
                      title="Restore to active items"
                    >
                      {isRestoring ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Restoring...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Restore
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Date/time info (read-only) */}
                {(selectedItem.type === 'reminder' && selectedItem.reminderDate) && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{format(new Date(selectedItem.reminderDate), 'MMM d, yyyy \'at\' h:mm a')}</span>
                  </div>
                )}

                {selectedItem.recurrence && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{formatRecurrence(selectedItem.recurrence)}</span>
                  </div>
                )}
              </div>

              {/* ON HOLD indicator */}
              {isOnHold && (
                <div className="mt-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                      ON HOLD
                    </span>
                    <span className="text-xs text-red-700">{onHoldReason}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Attachments section - always visible */}
            <div className={`border-b ${isDragging ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
              {/* Attachments header */}
              <div className="flex items-center justify-between px-3 py-2">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                  <span>📎</span>
                  Attachments
                </h3>
                <div className="flex items-center gap-2">
                  {selectedItem.attachments.length > 0 && (
                    <span className="text-xs text-gray-500 font-medium">
                      {selectedItem.attachments.length}
                    </span>
                  )}
                  {!readOnly && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAttachment}
                      className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      {isUploadingAttachment ? 'Uploading...' : '+ Add'}
                    </button>
                  )}
                </div>
              </div>

              {/* Drag indicator */}
              {isDragging && (
                <div className="px-3 py-4 text-center text-blue-600 text-sm">
                  Drop files here to upload
                </div>
              )}

              {/* Upload progress indicator */}
              {isUploadingAttachment && (
                <div className="px-3 py-3 flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm text-blue-600">Uploading file...</span>
                </div>
              )}

              {/* Attachment thumbnails */}
              {selectedItem.attachments.length > 0 && !isDragging && !isUploadingAttachment && (
                <div className="px-3 py-2 flex gap-2 overflow-x-auto">
                  {selectedItem.attachments
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((attachment) => (
                      <div
                        key={attachment.id}
                        className="relative flex-shrink-0 w-16 h-16 bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 group"
                        onClick={async () => {
                          try {
                            const url = await getAttachmentUrl(attachment.filePath);
                            window.open(url, '_blank');
                          } catch (error) {
                            console.error('Failed to get attachment URL:', error);
                            alert('Failed to open attachment. Please try again.');
                          }
                        }}
                        title={attachment.fileName}
                      >
                        {attachment.fileType.startsWith('image/') ? (
                          <AttachmentThumbnail attachment={attachment} getAttachmentUrl={getAttachmentUrl} />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                            <span className="text-2xl">📄</span>
                            <span className="text-[9px] text-gray-500 truncate max-w-full px-1">
                              {attachment.fileName.length > 10
                                ? attachment.fileName.substring(0, 7) + '...'
                                : attachment.fileName}
                            </span>
                          </div>
                        )}
                        {/* Download button overlay */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const url = await getAttachmentUrl(attachment.filePath);
                              // Fetch as blob to force download (cross-origin URLs ignore download attribute)
                              const response = await fetch(url);
                              const blob = await response.blob();
                              const blobUrl = window.URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = blobUrl;
                              link.download = attachment.fileName;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              window.URL.revokeObjectURL(blobUrl);
                            } catch (error) {
                              console.error('Failed to download:', error);
                              alert('Failed to download file. Please try again.');
                            }
                          }}
                          className="absolute top-0.5 left-0.5 w-4 h-4 bg-blue-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          title="Download"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        {/* Delete button overlay - hidden in read-only mode */}
                        {!readOnly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAttachment(attachment);
                            }}
                            className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                            title="Delete"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="hidden"
            />

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {selectedItem.notes.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  No notes yet
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedItem.notes
                    .filter(note => {
                      // Filter out ON HOLD and OFF HOLD notes since we show them as banner
                      const lower = note.content.toLowerCase();
                      return !lower.startsWith('on hold') && lower !== 'off hold';
                    })
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((note) => {
                      const isEditing = editingNoteId === note.id;

                      return (
                        <div key={note.id} className="bg-white border border-gray-200 rounded p-3">
                          {isEditing ? (
                            // Edit mode
                            <div>
                              <textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.metaKey) {
                                    handleUpdateNote(note.id);
                                  } else if (e.key === 'Escape') {
                                    setEditingNoteId(null);
                                    setEditingContent('');
                                  }
                                }}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleUpdateNote(note.id)}
                                  disabled={isEditProcessing}
                                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                                >
                                  {isEditProcessing ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setEditingContent('');
                                  }}
                                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            // Display mode
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="text-sm text-gray-700">
                                  {renderTextWithLinks(note.content)}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {format(new Date(note.timestamp), 'MMM d, h:mm a')}
                                </div>
                              </div>

                              {/* Actions menu - hidden in read-only mode */}
                              {!readOnly && (
                                <div className="relative">
                                  <button
                                    onClick={() => {
                                      setEditingNoteId(note.id);
                                      setEditingContent(note.content);
                                    }}
                                    className="text-gray-400 hover:text-blue-600 p-1"
                                    title="Edit"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="text-gray-400 hover:text-red-600 p-1 ml-1"
                                    title="Delete"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Note input - hidden in read-only mode */}
            {!readOnly && (
            <div className="px-3 py-3 bg-white border-t border-gray-200">
              {/* ON HOLD tag mode */}
              {showOnHoldTag && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                      ON HOLD
                    </span>
                    <input
                      ref={reasonInputRef}
                      type="text"
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNote();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowOnHoldTag(false);
                          setHoldReason('');
                          setTimeout(() => inputRef.current?.focus(), 0);
                        } else if ((e.key === 'Backspace' || e.key === 'Delete') && !holdReason) {
                          // Clear tag if backspace/delete pressed when input is empty
                          e.preventDefault();
                          e.stopPropagation();
                          setShowOnHoldTag(false);
                          setTimeout(() => inputRef.current?.focus(), 0);
                        }
                      }}
                      placeholder="Reason for on hold?"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isProcessing}
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              )}

              {/* OFF HOLD tag mode */}
              {showOffHoldTag && (
                <div
                  ref={offHoldContainerRef}
                  className="flex items-center gap-2 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddNote();
                    } else if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Delete') {
                      // Clear tag on Escape, Backspace, or Delete
                      e.preventDefault();
                      e.stopPropagation();
                      setShowOffHoldTag(false);
                      setTimeout(() => inputRef.current?.focus(), 0);
                    }
                  }}
                  tabIndex={0}
                >
                  <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">
                    OFF HOLD
                  </span>
                  <div className="flex-1 px-3 py-2 text-sm text-gray-400 italic">
                    Press Enter to remove ON HOLD status
                  </div>
                  <button
                    onClick={handleAddNote}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Adding...' : 'Add'}
                  </button>
                </div>
              )}

              {/* Regular note input */}
              {!showOnHoldTag && !showOffHoldTag && (
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNote();
                      } else if (e.key === 'Escape') {
                        if (noteInput.trim()) {
                          // First Esc: Clear the input
                          e.preventDefault();
                          e.stopPropagation();
                          setNoteInput('');
                        } else {
                          // Second Esc (or first if empty): Blur to allow App.tsx to close Notes
                          e.currentTarget.blur();
                        }
                      } else if ((e.key === 'Backspace' || e.key === 'Delete') && !noteInput && onDeleteItem) {
                        // Backspace/Delete on empty input triggers item deletion
                        e.preventDefault();
                        onDeleteItem();
                      }
                    }}
                    placeholder="Add a note..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isProcessing}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!noteInput.trim() || isProcessing}
                    className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Adding...' : 'Add'}
                  </button>
                </div>
              )}
            </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select an item to view notes
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component for attachment thumbnails
interface AttachmentThumbnailProps {
  attachment: Attachment;
  getAttachmentUrl: (filePath: string) => Promise<string>;
}

const AttachmentThumbnail: React.FC<AttachmentThumbnailProps> = ({ attachment, getAttachmentUrl }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadThumbnail = async () => {
      try {
        const url = await getAttachmentUrl(attachment.filePath);
        if (mounted) {
          setThumbnailUrl(url);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load thumbnail:', error);
        if (mounted) setLoading(false);
      }
    };
    loadThumbnail();
    return () => { mounted = false; };
  }, [attachment.filePath, getAttachmentUrl]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 animate-pulse">
        <div className="w-8 h-8 bg-gray-200 rounded" />
      </div>
    );
  }

  return thumbnailUrl ? (
    <img
      src={thumbnailUrl}
      alt={attachment.fileName}
      className="w-full h-full object-cover"
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <span className="text-xl">🖼️</span>
    </div>
  );
};
