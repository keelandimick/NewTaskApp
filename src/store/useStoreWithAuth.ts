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
  }, [userId, user?.email, store]);

  // Create wrapped functions that automatically include userId
  const addItem = async (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'notes'>) => {
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

  const restoreItem = async (id: string) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateRef.current = Date.now();
    return store.restoreItem(id, userId);
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
    selectedItemId: store.selectedItemId,
    highlightedItemId: store.highlightedItemId,
    loading: store.loading,
    error: store.error,

    // Functions that need userId
    addItem,
    updateItem,
    deleteItem,
    restoreItem,
    permanentlyDeleteItem,
    emptyTrash,
    moveItem,
    addNote,
    deleteNote,
    updateNote,
    addList,
    updateList,
    deleteList,

    // Functions that don't need userId
    reorderItems: (activeId: string, overId: string) => {
      lastUpdateRef.current = Date.now();
      return store.reorderItems(activeId, overId);
    },
    setCurrentList,
    signOut,
    setCurrentView: store.setCurrentView,
    setSelectedItem: store.setSelectedItem,
    setHighlightedItem: store.setHighlightedItem,
    getFilteredItems: store.getFilteredItems,

    // Utility
    isAuthenticated: !!userId,
  };
};