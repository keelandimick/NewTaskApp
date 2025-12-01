import { useEffect, useRef } from 'react';
import { useStore } from './useStore';
import { useAuth } from '../contexts/AuthContext';
import { Item, List, TaskStatus, ReminderStatus } from '../types';

// This hook wraps the store and automatically provides the userId from auth context
export const useStoreWithAuth = () => {
  const store = useStore();
  const { user, signOut } = useAuth();
  const userId = user?.id;

  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const lastUpdateRef = useRef<number>(0);

  // Load data and set up polling when user is available
  useEffect(() => {
    if (!userId || !user?.email) {
      hasLoadedRef.current = false;
      isLoadingRef.current = false;
      store.cleanupRealtimeSubscriptions(); // Clean up subscriptions on logout
      return;
    }

    // Load initial data
    if (!hasLoadedRef.current && !isLoadingRef.current) {
      hasLoadedRef.current = true;
      isLoadingRef.current = true;
      store.loadData(userId).finally(() => {
        isLoadingRef.current = false;
      });
    }

    // Set up simple polling every 30 seconds (less aggressive)
    // Note: Polling is skipped for shared lists (they use realtime)
    const interval = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;

      // Don't poll for 15 seconds after any update
      if (timeSinceLastUpdate < 15000) {
        return;
      }

      if (!isLoadingRef.current) {
        store.loadData(userId);
      }
    }, 30000); // 30 seconds

    // Cleanup interval on unmount or user change
    return () => {
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user?.email]);

  // Create wrapped functions that automatically include userId
  const addItem = async (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'notes' | 'attachments'>) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.addItem(item, userId);
  };

  const updateItem = async (id: string, updates: Partial<Item>) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.updateItem(id, updates, userId);
  };

  const deleteItem = async (id: string) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.deleteItem(id, userId);
  };

  const permanentlyDeleteItem = async (id: string) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.permanentlyDeleteItem(id, userId);
  };

  const emptyTrash = async () => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.emptyTrash(userId);
  };

  const moveItem = async (itemId: string, newStatus: TaskStatus | ReminderStatus) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.moveItem(itemId, newStatus, userId);
  };

  const addNote = async (itemId: string, content: string) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.addNote(itemId, content, userId);
  };

  const deleteNote = async (itemId: string, noteId: string) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.deleteNote(itemId, noteId, userId);
  };

  const updateNote = async (itemId: string, noteId: string, content: string) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.updateNote(itemId, noteId, content, userId);
  };

  const addAttachment = async (itemId: string, file: File) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.addAttachment(itemId, file, userId);
  };

  const deleteAttachment = async (itemId: string, attachmentId: string, filePath: string) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.deleteAttachment(itemId, attachmentId, filePath, userId);
  };

  const addList = async (list: Omit<List, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.addList(list, userId);
  };

  const updateList = async (id: string, updates: Partial<List>) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.updateList(id, updates, userId);
  };

  const deleteList = async (id: string) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.deleteList(id, userId);
  };

  const setCurrentList = (listId: string) => {
    store.setCurrentList(listId);
    // Save to localStorage when user changes list
    if (userId) {
      localStorage.setItem(`selectedList-${userId}`, listId);
    }
  };


  // Return all store properties and wrapped functions
  return {
    // State
    items: store.items,
    lists: store.lists,
    currentListId: store.currentListId,
    currentView: store.currentView,
    displayMode: store.displayMode,
    isDashboardView: store.isDashboardView,
    selectedItemId: store.selectedItemId,
    highlightedItemId: store.highlightedItemId,
    loading: store.loading,
    error: store.error,
    searchQuery: store.searchQuery,
    itemsInFlight: store.itemsInFlight,

    // Functions that need userId
    addItem,
    updateItem,
    deleteItem,
    permanentlyDeleteItem,
    emptyTrash,
    moveItem,
    addNote,
    deleteNote,
    updateNote,
    addAttachment,
    deleteAttachment,
    getAttachmentUrl: store.getAttachmentUrl,
    addList,
    updateList,
    deleteList,

    // Refresh data (for visibility change, etc.)
    refreshData: async () => {
      if (userId && !isLoadingRef.current) {
        console.log('🔄 Refreshing data...');
        await store.loadData(userId);
      }
    },

    // Functions that don't need userId
    reorderItems: (activeId: string, overId: string) => {
      lastUpdateRef.current = Date.now();
      return store.reorderItems(activeId, overId);
    },
    setCurrentList,
    signOut,
    setCurrentView: store.setCurrentView,
    setDisplayMode: store.setDisplayMode,
    setDashboardView: store.setDashboardView,
    setSelectedItem: store.setSelectedItem,
    setHighlightedItem: store.setHighlightedItem,
    setSearchQuery: store.setSearchQuery,
    getFilteredItems: store.getFilteredItems,
    searchItems: store.searchItems,

    // Utility
    isAuthenticated: !!userId,
  };
};