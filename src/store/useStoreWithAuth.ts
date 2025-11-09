import { useEffect, useRef } from 'react';
import { useStore } from './useStore';
import { useAuth } from '../contexts/AuthContext';
import { Item, List, ViewMode, Note, TaskStatus, ReminderStatus, SortMode } from '../types';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// This hook wraps the store and automatically provides the userId from auth context
export const useStoreWithAuth = () => {
  const store = useStore();
  const { user } = useAuth();
  const userId = user?.id;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasLoadedRef = useRef(false);

  // Load data and set up real-time subscriptions when user is available
  useEffect(() => {
    if (!userId) {
      hasLoadedRef.current = false;
      return;
    }

    // Load initial data
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      store.loadData(userId);
    }

    // Set up real-time subscriptions
    const channel = supabase
      .channel(`user-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          // Reload data on any change to items
          // This ensures consistency with the database
          await store.loadData(userId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lists',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          // Reload data on any change to lists
          await store.loadData(userId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          // Reload data on any change to notes
          await store.loadData(userId);
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup subscription on unmount or user change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, store]);

  // Create wrapped functions that automatically include userId
  const addItem = (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'notes'>) => {
    if (!userId) throw new Error('User must be authenticated');
    return store.addItem(item, userId);
  };

  const updateItem = (id: string, updates: Partial<Item>) => {
    if (!userId) throw new Error('User must be authenticated');
    return store.updateItem(id, updates, userId);
  };

  const deleteItem = (id: string) => {
    if (!userId) throw new Error('User must be authenticated');
    return store.deleteItem(id, userId);
  };

  const moveItem = (itemId: string, newStatus: TaskStatus | ReminderStatus) => {
    if (!userId) throw new Error('User must be authenticated');
    return store.moveItem(itemId, newStatus, userId);
  };

  const addNote = (itemId: string, content: string) => {
    if (!userId) throw new Error('User must be authenticated');
    return store.addNote(itemId, content, userId);
  };

  const addList = (list: Omit<List, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!userId) throw new Error('User must be authenticated');
    return store.addList(list, userId);
  };

  const updateList = (id: string, updates: Partial<List>) => {
    if (!userId) throw new Error('User must be authenticated');
    return store.updateList(id, updates, userId);
  };

  const deleteList = (id: string) => {
    if (!userId) throw new Error('User must be authenticated');
    return store.deleteList(id, userId);
  };

  // Return all store properties and wrapped functions
  return {
    // State
    items: store.items,
    lists: store.lists,
    currentListId: store.currentListId,
    currentView: store.currentView,
    sortMode: store.sortMode,
    selectedItemId: store.selectedItemId,
    highlightedItemId: store.highlightedItemId,
    loading: store.loading,
    error: store.error,

    // Functions that need userId
    addItem,
    updateItem,
    deleteItem,
    moveItem,
    addNote,
    addList,
    updateList,
    deleteList,

    // Functions that don't need userId
    reorderItems: store.reorderItems,
    setCurrentList: store.setCurrentList,
    setCurrentView: store.setCurrentView,
    setSortMode: store.setSortMode,
    setSelectedItem: store.setSelectedItem,
    setHighlightedItem: store.setHighlightedItem,
    getFilteredItems: store.getFilteredItems,

    // Utility
    isAuthenticated: !!userId,
  };
};