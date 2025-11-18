import { useEffect, useRef } from 'react';
import { useStore } from './useStore';
import { useAuth } from '../contexts/AuthContext';
import { Item, List, TaskStatus, ReminderStatus } from '../types';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// This hook wraps the store and automatically provides the userId from auth context
export const useStoreWithAuth = () => {
  const store = useStore();
  const { user, signOut } = useAuth();
  const userId = user?.id;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const lastUpdateTimeRef = useRef<number>(0);
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load data and set up real-time subscriptions when user is available
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

    // Set up real-time subscriptions
    const channel = supabase
      .channel(`user-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
        },
        async (payload) => {
          // Check if this item belongs to a list we have access to
          // We'll reload data if it does
          const now = Date.now();
          const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
          
          // If an update was made less than 3 seconds ago, delay the reload
          // This gives more time for database transactions to complete
          if (timeSinceLastUpdate < 3000) {
            if (reloadTimeoutRef.current) {
              clearTimeout(reloadTimeoutRef.current);
            }
            reloadTimeoutRef.current = setTimeout(async () => {
              if (!isLoadingRef.current) {
                await store.loadData(userId);
              }
            }, 3000 - timeSinceLastUpdate);
          } else {
            // Reload data on any change to items
            // This ensures consistency with the database
            if (!isLoadingRef.current) {
              await store.loadData(userId);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lists',
        },
        async (payload) => {
          // Check if this is a list we own or are shared with
          const list = payload.new as any;
          const isOurList = list?.user_id === userId || 
                           (list?.shared_with && list.shared_with.includes(user.email));
          
          if (isOurList && !isLoadingRef.current) {
            await store.loadData(userId);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
        },
        async () => {
          // Reload data on any change to notes
          if (!isLoadingRef.current) {
            await store.loadData(userId);
          }
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
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
    };
  }, [userId, user?.email, store]);

  // Create wrapped functions that automatically include userId
  const addItem = (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'notes'>) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateTimeRef.current = Date.now();
    return store.addItem(item, userId);
  };

  const updateItem = (id: string, updates: Partial<Item>) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateTimeRef.current = Date.now();
    return store.updateItem(id, updates, userId);
  };

  const deleteItem = (id: string) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateTimeRef.current = Date.now();
    return store.deleteItem(id, userId);
  };

  const restoreItem = (id: string) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateTimeRef.current = Date.now();
    return store.restoreItem(id, userId);
  };

  const permanentlyDeleteItem = (id: string) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateTimeRef.current = Date.now();
    return store.permanentlyDeleteItem(id, userId);
  };

  const emptyTrash = () => {
    if (!userId) throw new Error('User must be authenticated');
    return store.emptyTrash(userId);
  };

  const moveItem = (itemId: string, newStatus: TaskStatus | ReminderStatus) => {
    if (!userId) throw new Error('User must be authenticated');
    lastUpdateTimeRef.current = Date.now();
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
    lastUpdateTimeRef.current = Date.now();
    return store.updateList(id, updates, userId);
  };

  const deleteList = (id: string) => {
    if (!userId) throw new Error('User must be authenticated');
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
    addList,
    updateList,
    deleteList,

    // Functions that don't need userId
    reorderItems: store.reorderItems,
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