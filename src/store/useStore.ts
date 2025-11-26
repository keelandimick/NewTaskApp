import { create } from 'zustand';
import { Item, List, ViewMode, DisplayMode, TaskStatus, ReminderStatus } from '../types';
import { db, dbItemToItem, dbListToList, dbNoteToNote } from '../lib/database';
import { calculateReminderStatus } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Store {
  items: Item[];
  lists: List[];
  currentListId: string;
  currentView: ViewMode;
  displayMode: DisplayMode;
  isDashboardView: boolean;
  selectedItemId: string | null;
  highlightedItemId: string | null;
  loading: boolean;
  error: string | null;
  recentlyUpdatedItems: Set<string>;
  itemsInFlight: Set<string>;
  searchQuery: string;

  loadData: (userId: string) => Promise<void>;
  addItem: (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'notes'>, userId: string) => Promise<string>;
  updateItem: (id: string, updates: Partial<Item>, userId: string) => Promise<void>;
  deleteItem: (id: string, userId: string) => Promise<void>;
  restoreItem: (id: string, userId: string) => Promise<void>;
  permanentlyDeleteItem: (id: string, userId: string) => Promise<void>;
  emptyTrash: (userId: string) => Promise<void>;
  moveItem: (itemId: string, newStatus: TaskStatus | ReminderStatus, userId: string) => Promise<void>;
  reorderItems: (activeId: string, overId: string) => void;

  addNote: (itemId: string, content: string, userId: string) => Promise<void>;
  deleteNote: (itemId: string, noteId: string, userId: string) => Promise<void>;
  updateNote: (itemId: string, noteId: string, content: string, userId: string) => Promise<void>;

  addList: (list: Omit<List, 'id' | 'createdAt' | 'updatedAt'>, userId: string) => Promise<void>;
  updateList: (id: string, updates: Partial<List>, userId: string) => Promise<void>;
  deleteList: (id: string, userId: string) => Promise<void>;

  setCurrentList: (listId: string) => void;
  setCurrentView: (view: ViewMode) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setDashboardView: (isDashboard: boolean) => void;
  setSelectedItem: (itemId: string | null) => void;
  setHighlightedItem: (itemId: string | null) => void;
  setSearchQuery: (query: string) => void;

  getFilteredItems: () => Item[];
  searchItems: (query: string) => Item[];

  // Realtime handlers
  handleRealtimeInsert: (table: 'items' | 'lists' | 'notes', record: any) => void;
  handleRealtimeUpdate: (table: 'items' | 'lists' | 'notes', record: any) => void;
  handleRealtimeDelete: (table: 'items' | 'lists' | 'notes', id: string) => void;
  isListShared: (listId: string) => boolean;

  // Realtime subscription management
  setupRealtimeSubscriptions: () => void;
  cleanupRealtimeSubscriptions: () => void;
}

// Store Realtime channels outside of Zustand state (they're not serializable)
let realtimeChannels: {
  items?: RealtimeChannel;
  lists?: RealtimeChannel;
  notes?: RealtimeChannel;
} = {};
let subscriptionsActive = false;

export const useStore = create<Store>((set, get) => ({
  items: [],
  lists: [],
  currentListId: localStorage.getItem('currentListId') || '',
  currentView: (localStorage.getItem('currentView') as ViewMode) || 'tasks',
  displayMode: (localStorage.getItem('displayMode') as DisplayMode) || 'column',
  isDashboardView: localStorage.getItem('isDashboardView') === 'true',
  selectedItemId: null,
  highlightedItemId: null,
  loading: false,
  error: null,
  recentlyUpdatedItems: new Set<string>(),
  itemsInFlight: new Set<string>(),
  searchQuery: '',
  
  loadData: async (userId: string) => {
    set({ loading: true, error: null });

    // Safety timeout - ensure loading doesn't get stuck
    const timeout = setTimeout(() => {
      console.warn('[Store] Loading timeout - forcing loading to false');
      set({ loading: false });
    }, 10000); // 10 seconds

    try {
      const [lists, items] = await Promise.all([
        db.getLists(userId),
        db.getItems(userId),
      ]);
      
      // Check if user has any lists, if not create a default one
      if (lists.length === 0) {
        try {
          // Try to create the default list
          const newList = await db.createList(
            { name: 'Personal', color: '#3B82F6' },
            userId
          );
          lists.push(newList);
        } catch (error) {
          // If creation fails (e.g., due to a unique constraint), reload lists
          const updatedLists = await db.getLists(userId);
          lists.length = 0;
          lists.push(...updatedLists);
        }
      }
      
      // Try to restore the selected list from localStorage
      const currentState = get();
      let selectedListId = currentState.currentListId;
      
      // Check localStorage for saved list selection
      const savedListId = localStorage.getItem(`selectedList-${userId}`);
      if (savedListId && (savedListId === 'all' || lists.find(l => l.id === savedListId))) {
        selectedListId = savedListId;
      }
      // If no list is selected or the selected list doesn't exist, select "all"
      else if (!selectedListId || selectedListId === 'default' || (selectedListId !== 'all' && !lists.find(l => l.id === selectedListId))) {
        selectedListId = 'all';
      }
      
      // Merge items intelligently - don't overwrite recently updated items
      const recentlyUpdated = currentState.recentlyUpdatedItems;
      
      const mergedItems = items.map(dbItem => {
        // If this item was recently updated locally, keep the local version
        if (recentlyUpdated.has(dbItem.id)) {
          const localItem = currentState.items.find(i => i.id === dbItem.id);
          return localItem || dbItem;
        }
        return dbItem;
      });
      
      clearTimeout(timeout);
      set({
        lists,
        items: mergedItems,
        currentListId: selectedListId,
        loading: false
      });

      // Set up realtime subscriptions after data loads
      get().setupRealtimeSubscriptions();
    } catch (error) {
      clearTimeout(timeout);
      console.error('Failed to load data:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load data',
        loading: false
      });
    }
  },
  
  addItem: async (itemData, userId) => {
    set({ error: null });
    try {
      const newItem = await db.createItem(itemData, userId);
      
      set((state) => ({
        items: [...state.items, newItem],
      }));
      
      return newItem.id;
    } catch (error) {
      console.error('Failed to add item:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to add item' });
      throw error;
    }
  },
  
  updateItem: async (id, updates, userId) => {
    set({ error: null });
    try {
      const state = get();
      const item = state.items.find(i => i.id === id);
      if (!item) throw new Error('Item not found');

      const isShared = state.isListShared(item.listId);

      if (isShared) {
        // For shared lists: Add to itemsInFlight, wait for realtime confirmation
        set((s) => ({
          itemsInFlight: new Set(s.itemsInFlight).add(id)
        }));

        // Set timeout to remove from itemsInFlight if realtime doesn't respond
        const timeoutId = setTimeout(() => {
          set((s) => {
            const newSet = new Set(s.itemsInFlight);
            newSet.delete(id);
            return { itemsInFlight: newSet };
          });
        }, 5000);

        // Update database
        await db.updateItem(id, updates, userId);

        // Clear timeout when realtime confirms (handler will remove from itemsInFlight)
        // Note: The realtime handler removes it, so we clear the timeout to avoid double-removal
        setTimeout(() => clearTimeout(timeoutId), 100);
      } else {
        // For non-shared lists: Use optimistic updates (current behavior)
        set((state) => {
          const newRecentlyUpdated = new Set(state.recentlyUpdatedItems);
          newRecentlyUpdated.add(id);

          // Clear this item from recently updated after 20 seconds
          setTimeout(() => {
            set((s) => {
              const updated = new Set(s.recentlyUpdatedItems);
              updated.delete(id);
              return { recentlyUpdatedItems: updated };
            });
          }, 20000);

          return {
            items: state.items.map((item) =>
              item.id === id
                ? { ...item, ...updates, updatedAt: new Date() } as Item
                : item
            ),
            recentlyUpdatedItems: newRecentlyUpdated
          };
        });

        // Then update the database
        await db.updateItem(id, updates, userId);

        // If the update included a status change for reminders, ensure it's properly calculated
        if (updates.type === 'reminder' && updates.reminderDate && !updates.status) {
          const calculatedStatus = calculateReminderStatus(updates.reminderDate);
          set((state) => ({
            items: state.items.map((item) =>
              item.id === id
                ? { ...item, status: calculatedStatus } as Item
                : item
            ),
          }));
        }
      }
    } catch (error) {
      console.error('Failed to update item:', error);
      // Remove from itemsInFlight on error
      set((s) => {
        const newSet = new Set(s.itemsInFlight);
        newSet.delete(id);
        return { itemsInFlight: newSet };
      });
      // Revert the optimistic update on error
      await get().loadData(userId);
      set({ error: error instanceof Error ? error.message : 'Failed to update item' });
      throw error;
    }
  },
  
  deleteItem: async (id, userId) => {
    set({ error: null });
    try {
      // Soft delete - mark as deleted instead of removing
      const now = new Date();

      // First update local state optimistically and protect it
      set((state) => {
        const newRecentlyUpdated = new Set(state.recentlyUpdatedItems);
        newRecentlyUpdated.add(id);

        // Clear this item from protection after 20 seconds
        setTimeout(() => {
          set((s) => {
            const updated = new Set(s.recentlyUpdatedItems);
            updated.delete(id);
            return { recentlyUpdatedItems: updated };
          });
        }, 20000);

        return {
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, deletedAt: now, updatedAt: now }
              : item
          ),
          // Clear selected item if it's the one being deleted
          selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
          recentlyUpdatedItems: newRecentlyUpdated
        };
      });

      // Then update the database
      await db.updateItem(id, { deletedAt: now }, userId);
    } catch (error) {
      console.error('Failed to delete item:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to delete item' });
      throw error;
    }
  },
  
  restoreItem: async (id, userId) => {
    set({ error: null });
    try {
      const item = get().items.find(i => i.id === id);
      if (!item) return;

      // Determine appropriate status based on item type
      let restoredStatus: any;
      if (item.type === 'task') {
        restoredStatus = 'start';
      } else if (item.type === 'reminder' && item.recurrence) {
        restoredStatus = item.recurrence.frequency;
      } else if (item.type === 'reminder') {
        restoredStatus = calculateReminderStatus(item.reminderDate);
      }

      await db.updateItem(id, { deletedAt: undefined, status: restoredStatus }, userId);
      
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id
            ? { ...item, deletedAt: undefined, status: restoredStatus, updatedAt: new Date() }
            : item
        ),
      }));
    } catch (error) {
      console.error('Failed to restore item:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to restore item' });
      throw error;
    }
  },

  permanentlyDeleteItem: async (id, userId) => {
    set({ error: null });
    try {
      await db.deleteItem(id, userId);
      
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
        // Clear selected item if it's the one being deleted
        selectedItemId: state.selectedItemId === id ? null : state.selectedItemId
      }));
    } catch (error) {
      console.error('Failed to permanently delete item:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to permanently delete item' });
      throw error;
    }
  },

  emptyTrash: async (userId) => {
    set({ error: null });
    try {
      const state = get();
      const trashedItems = state.items.filter(item => item.deletedAt != null);
      
      // Delete all trashed items
      await Promise.all(
        trashedItems.map(item => db.deleteItem(item.id, userId))
      );
      
      // Check if selected item is in trash
      const selectedItemInTrash = trashedItems.some(item => item.id === state.selectedItemId);
      
      set((state) => ({
        items: state.items.filter((item) => !item.deletedAt),
        // Clear selected item if it was in trash
        selectedItemId: selectedItemInTrash ? null : state.selectedItemId
      }));
    } catch (error) {
      console.error('Failed to empty trash:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to empty trash' });
      throw error;
    }
  },

  moveItem: async (itemId, newStatus, userId) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return;
    
    // Don't update if the status hasn't changed
    if (item.status === newStatus) return;
    
    const updates: any = { status: newStatus };
    
    if (item.type === 'reminder' && newStatus === 'today') {
      updates.reminderDate = new Date();
    }
    
    await get().updateItem(itemId, updates, userId);
  },
  
  reorderItems: (activeId, overId) => {
    const { items } = get();
    const activeIndex = items.findIndex((item) => item.id === activeId);
    const overIndex = items.findIndex((item) => item.id === overId);
    
    if (activeIndex === -1 || overIndex === -1) return;
    
    const newItems = [...items];
    const [movedItem] = newItems.splice(activeIndex, 1);
    newItems.splice(overIndex, 0, movedItem);
    
    set({ items: newItems });
  },
  
  addNote: async (itemId, content, userId) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return;
    
    set({ error: null });
    try {
      const newNote = await db.addNote(itemId, content, userId);
      
      set((state) => ({
        items: state.items.map((i) =>
          i.id === itemId
            ? { ...i, notes: [...i.notes, newNote] }
            : i
        ),
      }));
    } catch (error) {
      console.error('Failed to add note:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to add note' });
      throw error;
    }
  },

  deleteNote: async (itemId, noteId, userId) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return;
    
    set({ error: null });
    try {
      await db.deleteNote(noteId, userId);
      
      set((state) => ({
        items: state.items.map((i) =>
          i.id === itemId
            ? { ...i, notes: i.notes.filter(n => n.id !== noteId) }
            : i
        ),
      }));
    } catch (error) {
      console.error('Failed to delete note:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to delete note' });
      throw error;
    }
  },

  updateNote: async (itemId, noteId, content, userId) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return;
    
    set({ error: null });
    try {
      const updatedNote = await db.updateNote(noteId, content, userId);
      
      set((state) => ({
        items: state.items.map((i) =>
          i.id === itemId
            ? { ...i, notes: i.notes.map(n => n.id === noteId ? updatedNote : n) }
            : i
        ),
      }));
    } catch (error) {
      console.error('Failed to update note:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update note' });
      throw error;
    }
  },
  
  addList: async (listData, userId) => {
    set({ error: null });
    try {
      const newList = await db.createList(listData, userId);
      
      set((state) => ({
        lists: [...state.lists, newList],
      }));
    } catch (error) {
      console.error('Failed to add list:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to add list' });
      throw error;
    }
  },
  
  updateList: async (id, updates, userId) => {
    set({ error: null });
    try {
      await db.updateList(id, updates, userId);
      
      set((state) => ({
        lists: state.lists.map((list) =>
          list.id === id
            ? { ...list, ...updates, updatedAt: new Date() }
            : list
        ),
      }));
    } catch (error) {
      console.error('Failed to update list:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update list' });
      throw error;
    }
  },
  
  deleteList: async (id, userId) => {
    set({ error: null });
    try {
      const state = get();
      const remainingLists = state.lists.filter((list) => list.id !== id);
      // Get the first list as the default (or use 'all' if no lists remain)
      const defaultListId = remainingLists.length > 0 ? remainingLists[0].id : 'all';
      
      // Find trash items from the deleted list that need to be reassigned
      const trashItemsToReassign = state.items.filter(
        item => item.listId === id && item.deletedAt
      );
      
      // Update trash items in the database to use the default list
      await Promise.all(
        trashItemsToReassign.map(item => 
          db.updateItem(item.id, { listId: defaultListId }, userId)
        )
      );
      
      // Delete the list
      await db.deleteList(id, userId);
      
      set((state) => {
        const remainingLists = state.lists.filter((list) => list.id !== id);
        
        return {
          lists: remainingLists,
          items: state.items.map((item) => {
            // If item belongs to deleted list
            if (item.listId === id) {
              // If it's in trash, reassign to default list
              if (item.deletedAt) {
                return { ...item, listId: defaultListId };
              }
              // If not in trash, remove it
              return null;
            }
            return item;
          }).filter(Boolean) as Item[],
          currentListId: state.currentListId === id ? defaultListId : state.currentListId,
        };
      });
    } catch (error) {
      console.error('Failed to delete list:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to delete list' });
      throw error;
    }
  },
  
  setCurrentList: (listId) => {
    set({ currentListId: listId });
    localStorage.setItem('currentListId', listId);
  },

  setCurrentView: (view) => {
    set({ currentView: view });
    localStorage.setItem('currentView', view);
  },

  setDisplayMode: (mode) => {
    set({ displayMode: mode });
    localStorage.setItem('displayMode', mode);
  },

  setDashboardView: (isDashboard) => {
    set({ isDashboardView: isDashboard });
    localStorage.setItem('isDashboardView', isDashboard.toString());
  },

  setSelectedItem: (itemId) => {
    set({ selectedItemId: itemId });
  },
  
  setHighlightedItem: (itemId) => {
    set({ highlightedItemId: itemId });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },
  
  getFilteredItems: () => {
    const { items, currentListId, currentView } = get();
    
    let filteredItems: Item[] = [];
    
    // For trash view, show all deleted items
    if (currentView === 'trash') {
      filteredItems = items.filter(item => item.deletedAt != null);
    }
    // For complete view, show all completed items (not deleted)
    else if (currentView === 'complete') {
      filteredItems = items.filter(item => item.status === 'complete' && !item.deletedAt);
    }
    // For reminders and recurring views, filter by current list
    else if (currentView === 'reminders' || currentView === 'recurring') {
      filteredItems = items
        .filter((item) => {
          // Exclude deleted items
          if (item.deletedAt) return false;
          
          // Filter by current list (unless viewing "all")
          if (currentListId !== 'all' && item.listId !== currentListId) return false;
          
          if (currentView === 'recurring') {
            // Only show items with recurrence
            return item.recurrence !== undefined;
          }
          // For reminders view, show reminders without recurrence
          return item.type === 'reminder' && !item.recurrence;
        })
        .map((item) => {
          // Auto-calculate status for reminders based on date (but keep complete items as complete)
          if (item.type === 'reminder' && currentView === 'reminders' && item.status !== 'complete') {
            const calculatedStatus = calculateReminderStatus(item.reminderDate);
            return { ...item, status: calculatedStatus };
          }
          // Set status based on recurrence frequency for recurring view (but keep complete items as complete)
          if (item.recurrence && currentView === 'recurring' && item.status !== 'complete') {
            // Map minutely and hourly items to daily column (they'll show with interval text)
            const frequency = (item.recurrence.frequency === 'minutely' || item.recurrence.frequency === 'hourly')
              ? 'daily'
              : item.recurrence.frequency;
            return { ...item, status: frequency as any };
          }
          return item;
        });
    } else {
      // For tasks view, filter by list and exclude deleted items
      if (currentListId === 'all') {
        filteredItems = items.filter(
          (item) => item.type === 'task' && !item.deletedAt
        );
      } else {
        filteredItems = items.filter(
          (item) => item.listId === currentListId && item.type === 'task' && !item.deletedAt
        );
      }
    }
    
    // Apply sorting
    // Always sort by priority for tasks, but maintain order within priority groups
    if (currentView === 'tasks') {
      // Group by priority while preserving the relative order within each group
      const nowItems = filteredItems.filter(item => item.priority === 'now');
      const highItems = filteredItems.filter(item => item.priority === 'high');
      const lowItems = filteredItems.filter(item => item.priority === 'low');
      
      // If viewing "All" list, sort within each priority group by listId
      if (currentListId === 'all') {
        const { lists } = get();
        const sortByList = (items: Item[]) => {
          return items.sort((a, b) => {
            // Sort by list order (as they appear in sidebar)
            const aListIndex = lists.findIndex(l => l.id === a.listId);
            const bListIndex = lists.findIndex(l => l.id === b.listId);
            return aListIndex - bListIndex;
          });
        };
        
        filteredItems = [
          ...sortByList(nowItems),
          ...sortByList(highItems),
          ...sortByList(lowItems)
        ];
      } else {
        // Recombine in priority order
        filteredItems = [...nowItems, ...highItems, ...lowItems];
      }
    } else if (currentView === 'reminders') {
      // Sort by reminder date (earlier dates first)
      filteredItems.sort((a, b) => {
        const aDate = (a as any).reminderDate;
        const bDate = (b as any).reminderDate;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
    } else if (currentView === 'recurring') {
      // Sort by time within each frequency
      filteredItems.sort((a, b) => {
        if (!a.recurrence || !b.recurrence) return 0;
        return a.recurrence.time.localeCompare(b.recurrence.time);
      });
    }
    
    return filteredItems;
  },

  searchItems: (query) => {
    const { items } = get();

    // If query is empty, return empty array
    if (!query.trim()) {
      return [];
    }

    const searchTerms = query.toLowerCase().trim().split(/\s+/);

    // Search across all non-deleted and non-completed items
    const results = items
      .filter(item => !item.deletedAt && item.status !== 'complete')
      .map(item => {
        let score = 0;
        const titleLower = item.title.toLowerCase();

        // Check title matches
        const titleMatches = searchTerms.every(term => titleLower.includes(term));
        if (titleMatches) {
          // Exact phrase match gets highest score
          if (titleLower.includes(query.toLowerCase())) {
            score += 100;
          } else {
            score += 50;
          }
        }

        // Check notes matches
        const notesText = item.notes.map(n => n.content.toLowerCase()).join(' ');
        const notesMatches = searchTerms.every(term => notesText.includes(term));
        if (notesMatches) {
          score += 30;
        }

        // Check date/time matches for reminders
        if (item.type === 'reminder' && item.reminderDate) {
          const dateStr = new Date(item.reminderDate).toLocaleDateString().toLowerCase();
          const dateMatches = searchTerms.some(term => dateStr.includes(term));
          if (dateMatches) {
            score += 20;
          }
        }

        // Check recurrence time matches
        if (item.recurrence?.time) {
          const timeMatches = searchTerms.some(term =>
            item.recurrence!.time.toLowerCase().includes(term)
          );
          if (timeMatches) {
            score += 20;
          }
        }

        return { item, score };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(result => result.item);

    return results;
  },

  // Helper to check if a list is shared
  isListShared: (listId) => {
    const { lists } = get();
    const list = lists.find(l => l.id === listId);
    return !!(list?.sharedWith && list.sharedWith.length > 0);
  },

  // Realtime event handlers
  handleRealtimeInsert: (table, record) => {
    const state = get();

    if (table === 'items') {
      // Convert database record to Item
      const item = dbItemToItem(record);

      // Check if item belongs to a shared list
      if (state.isListShared(item.listId)) {
        // Add item to store if it doesn't exist
        const exists = state.items.some(i => i.id === item.id);
        if (!exists) {
          set({ items: [...state.items, item] });
        }
      }
    } else if (table === 'lists') {
      // Convert database record to List
      const list = dbListToList(record);

      // Add list if it doesn't exist
      const exists = state.lists.some(l => l.id === list.id);
      if (!exists) {
        set({ lists: [...state.lists, list] });
      }
    }
  },

  handleRealtimeUpdate: (table, record) => {
    const state = get();

    if (table === 'items') {
      const item = dbItemToItem(record);

      // Remove from itemsInFlight (update confirmed)
      const newItemsInFlight = new Set(state.itemsInFlight);
      newItemsInFlight.delete(item.id);

      // Update the item in store
      set({
        items: state.items.map(i => i.id === item.id ? item : i),
        itemsInFlight: newItemsInFlight
      });
    } else if (table === 'lists') {
      const list = dbListToList(record);

      set({
        lists: state.lists.map(l => l.id === list.id ? list : l)
      });
    } else if (table === 'notes') {
      // Note updates require reloading the parent item
      const itemId = record.item_id;
      const item = state.items.find(i => i.id === itemId);

      if (item && state.isListShared(item.listId)) {
        // Reload notes for this item (simplified - could be more granular)
        const note = dbNoteToNote(record);
        const updatedNotes = item.notes.map(n => n.id === note.id ? note : n);
        const noteExists = item.notes.some(n => n.id === note.id);

        // Remove item from itemsInFlight
        const newItemsInFlight = new Set(state.itemsInFlight);
        newItemsInFlight.delete(itemId);

        set({
          items: state.items.map(i =>
            i.id === itemId
              ? { ...i, notes: noteExists ? updatedNotes : [...i.notes, note] }
              : i
          ),
          itemsInFlight: newItemsInFlight
        });
      }
    }
  },

  handleRealtimeDelete: (table, id) => {
    const state = get();

    if (table === 'items') {
      // Remove item from store
      set({
        items: state.items.filter(i => i.id !== id)
      });
    } else if (table === 'lists') {
      // Remove list from store
      set({
        lists: state.lists.filter(l => l.id !== id)
      });

      // If current list was deleted, switch to 'all'
      if (state.currentListId === id) {
        set({ currentListId: 'all' });
      }
    } else if (table === 'notes') {
      // Remove note from its parent item
      set({
        items: state.items.map(item => ({
          ...item,
          notes: item.notes.filter(n => n.id !== id)
        }))
      });
    }
  },

  // Set up Realtime subscriptions for shared lists
  setupRealtimeSubscriptions: () => {
    // Only set up once - set flag IMMEDIATELY to prevent race conditions
    if (subscriptionsActive) {
      console.log('[Realtime] Subscriptions already active, skipping setup');
      return;
    }
    subscriptionsActive = true;

    const state = get();

    // Subscribe to ALL lists the user has access to
    // This includes: lists they own AND lists shared with them
    const allListIds = state.lists.map(l => l.id);

    console.log('[Realtime] Setting up subscriptions for all accessible lists:', allListIds);

    if (allListIds.length === 0) {
      console.log('[Realtime] No lists found, skipping subscription setup');
      return;
    }

    // Subscribe to items table changes for all accessible lists
    realtimeChannels.items = supabase
      .channel('items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `list_id=in.(${allListIds.join(',')})`
        },
        (payload) => {
          console.log('[Realtime] Items change received:', {
            eventType: payload.eventType,
            listId: (payload.new as any)?.list_id || (payload.old as any)?.list_id,
            itemId: (payload.new as any)?.id || (payload.old as any)?.id,
            title: (payload.new as any)?.title
          });
          if (payload.eventType === 'INSERT') {
            get().handleRealtimeInsert('items', payload.new);
          } else if (payload.eventType === 'UPDATE') {
            get().handleRealtimeUpdate('items', payload.new);
          } else if (payload.eventType === 'DELETE') {
            get().handleRealtimeDelete('items', (payload.old as any).id);
          }
        }
      )
      .subscribe();

    // Subscribe to lists table changes (for all accessible lists being updated/deleted)
    realtimeChannels.lists = supabase
      .channel('lists-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lists',
          filter: `id=in.(${allListIds.join(',')})`
        },
        (payload) => {
          console.log('[Realtime] Lists change received:', {
            eventType: payload.eventType,
            listId: (payload.new as any)?.id || (payload.old as any)?.id,
            listName: (payload.new as any)?.name
          });
          if (payload.eventType === 'UPDATE') {
            get().handleRealtimeUpdate('lists', payload.new);
          } else if (payload.eventType === 'DELETE') {
            get().handleRealtimeDelete('lists', (payload.old as any).id);
          }
        }
      )
      .subscribe();

    // Subscribe to notes table changes
    realtimeChannels.notes = supabase
      .channel('shared-notes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes'
        },
        (payload) => {
          console.log('[Realtime] Notes change:', payload);
          // Note: We check if the item belongs to a shared list in the handler
          if (payload.eventType === 'INSERT') {
            get().handleRealtimeInsert('notes', payload.new);
          } else if (payload.eventType === 'UPDATE') {
            get().handleRealtimeUpdate('notes', payload.new);
          } else if (payload.eventType === 'DELETE') {
            get().handleRealtimeDelete('notes', payload.old.id);
          }
        }
      )
      .subscribe();
  },

  // Clean up Realtime subscriptions
  cleanupRealtimeSubscriptions: () => {
    console.log('[Realtime] Cleaning up subscriptions');

    if (realtimeChannels.items) {
      supabase.removeChannel(realtimeChannels.items);
      realtimeChannels.items = undefined;
    }
    if (realtimeChannels.lists) {
      supabase.removeChannel(realtimeChannels.lists);
      realtimeChannels.lists = undefined;
    }
    if (realtimeChannels.notes) {
      supabase.removeChannel(realtimeChannels.notes);
      realtimeChannels.notes = undefined;
    }

    subscriptionsActive = false;
  },
}));