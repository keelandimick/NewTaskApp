import { create } from 'zustand';
import { Item, List, ViewMode, TaskStatus, ReminderStatus } from '../types';
import { db } from '../lib/database';
import { calculateReminderStatus } from '../utils/dateUtils';

interface Store {
  items: Item[];
  lists: List[];
  currentListId: string;
  currentView: ViewMode;
  selectedItemId: string | null;
  highlightedItemId: string | null;
  loading: boolean;
  error: string | null;
  
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
  
  addList: (list: Omit<List, 'id' | 'createdAt' | 'updatedAt'>, userId: string) => Promise<void>;
  updateList: (id: string, updates: Partial<List>, userId: string) => Promise<void>;
  deleteList: (id: string, userId: string) => Promise<void>;
  
  setCurrentList: (listId: string) => void;
  setCurrentView: (view: ViewMode) => void;
  setSelectedItem: (itemId: string | null) => void;
  setHighlightedItem: (itemId: string | null) => void;
  
  getFilteredItems: () => Item[];
}



export const useStore = create<Store>((set, get) => ({
  items: [],
  lists: [],
  currentListId: '',
  currentView: 'tasks',
  selectedItemId: null,
  highlightedItemId: null,
  loading: false,
  error: null,
  
  loadData: async (userId: string) => {
    set({ loading: true, error: null });
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
      
      set({ 
        lists, 
        items,
        currentListId: selectedListId,
        loading: false 
      });
    } catch (error) {
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
      // First update the local state optimistically
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id
            ? { ...item, ...updates, updatedAt: new Date() } as Item
            : item
        ),
      }));
      
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
    } catch (error) {
      console.error('Failed to update item:', error);
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
      await db.updateItem(id, { deletedAt: now }, userId);
      
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id
            ? { ...item, deletedAt: now, updatedAt: now }
            : item
        ),
      }));
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
      const trashedItems = get().items.filter(item => item.deletedAt != null);
      
      // Delete all trashed items
      await Promise.all(
        trashedItems.map(item => db.deleteItem(item.id, userId))
      );
      
      set((state) => ({
        items: state.items.filter((item) => !item.deletedAt),
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
  },
  
  setCurrentView: (view) => {
    set({ currentView: view });
  },
  
  
  setSelectedItem: (itemId) => {
    set({ selectedItemId: itemId });
  },
  
  setHighlightedItem: (itemId) => {
    set({ highlightedItemId: itemId });
    if (itemId) {
      // Clear highlight after 2 seconds
      setTimeout(() => {
        set({ highlightedItemId: null });
      }, 2000);
    }
  },
  
  getFilteredItems: () => {
    const { items, currentListId, currentView } = get();
    
    let filteredItems: Item[] = [];
    
    // For trash view, show all deleted items
    if (currentView === 'trash') {
      filteredItems = items.filter(item => item.deletedAt != null);
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
            return { ...item, status: item.recurrence.frequency as any };
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
}));