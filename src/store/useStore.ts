import { create } from 'zustand';
import { Item, List, ViewMode, TaskStatus, ReminderStatus, SortMode, Priority } from '../types';
import { db } from '../lib/database';

interface Store {
  items: Item[];
  lists: List[];
  currentListId: string;
  currentView: ViewMode;
  sortMode: SortMode;
  selectedItemId: string | null;
  highlightedItemId: string | null;
  loading: boolean;
  error: string | null;
  
  loadData: (userId: string) => Promise<void>;
  addItem: (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'notes'>, userId: string) => Promise<string>;
  updateItem: (id: string, updates: Partial<Item>, userId: string) => Promise<void>;
  deleteItem: (id: string, userId: string) => Promise<void>;
  moveItem: (itemId: string, newStatus: TaskStatus | ReminderStatus, userId: string) => Promise<void>;
  reorderItems: (activeId: string, overId: string) => void;
  
  addNote: (itemId: string, content: string, userId: string) => Promise<void>;
  
  addList: (list: Omit<List, 'id' | 'createdAt' | 'updatedAt'>, userId: string) => Promise<void>;
  updateList: (id: string, updates: Partial<List>, userId: string) => Promise<void>;
  deleteList: (id: string, userId: string) => Promise<void>;
  
  setCurrentList: (listId: string) => void;
  setCurrentView: (view: ViewMode) => void;
  setSortMode: (mode: SortMode) => void;
  setSelectedItem: (itemId: string | null) => void;
  setHighlightedItem: (itemId: string | null) => void;
  
  getFilteredItems: () => Item[];
}

// Helper function to calculate reminder status based on date
const calculateReminderStatus = (reminderDate?: Date): ReminderStatus => {
  if (!reminderDate) return 'within7';
  
  const now = new Date();
  const reminder = new Date(reminderDate);
  
  // Reset time parts for date comparison
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const reminderDateOnly = new Date(reminder.getFullYear(), reminder.getMonth(), reminder.getDate());
  
  const diffTime = reminderDateOnly.getTime() - todayStart.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return 'today'; // Overdue goes to today
  } else if (diffDays === 0) {
    return 'today';
  } else if (diffDays <= 7) {
    return 'within7';
  } else {
    return '7plus';
  }
};

// Priority sort order: now > high > low
const priorityOrder: Record<Priority, number> = {
  now: 0,
  high: 1,
  low: 2,
};

export const useStore = create<Store>((set, get) => ({
  items: [],
  lists: [],
  currentListId: 'default',
  currentView: 'tasks',
  sortMode: 'custom',
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
        const newList = await db.createList(
          { name: 'Personal', color: '#3B82F6' },
          userId
        );
        lists.push(newList);
      }
      
      set({ 
        lists, 
        items,
        currentListId: lists[0].id,
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
      await db.updateItem(id, updates, userId);
      
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id
            ? { ...item, ...updates, updatedAt: new Date() } as Item
            : item
        ),
      }));
    } catch (error) {
      console.error('Failed to update item:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update item' });
      throw error;
    }
  },
  
  deleteItem: async (id, userId) => {
    set({ error: null });
    try {
      await db.deleteItem(id, userId);
      
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete item:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to delete item' });
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
      await db.deleteList(id, userId);
      
      set((state) => {
        const remainingLists = state.lists.filter((list) => list.id !== id);
        return {
          lists: remainingLists,
          items: state.items.filter((item) => item.listId !== id),
          currentListId: state.currentListId === id && remainingLists.length > 0 
            ? remainingLists[0].id 
            : state.currentListId,
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
  
  setSortMode: (mode) => {
    set({ sortMode: mode });
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
    const { items, currentListId, currentView, sortMode } = get();
    
    let filteredItems: Item[] = [];
    
    // For reminders and recurring views, show all items regardless of list
    if (currentView === 'reminders' || currentView === 'recurring') {
      filteredItems = items
        .filter((item) => {
          if (currentView === 'recurring') {
            // Only show items with recurrence
            return item.recurrence !== undefined;
          }
          // For reminders view, show reminders without recurrence
          return item.type === 'reminder' && !item.recurrence;
        })
        .map((item) => {
          // Auto-calculate status for reminders based on date
          if (item.type === 'reminder' && currentView === 'reminders') {
            const calculatedStatus = calculateReminderStatus(item.reminderDate);
            return { ...item, status: calculatedStatus };
          }
          // Set status based on recurrence frequency for recurring view
          if (item.recurrence && currentView === 'recurring') {
            return { ...item, status: item.recurrence.frequency as any };
          }
          return item;
        });
    } else {
      // For tasks view, filter by list
      filteredItems = items.filter(
        (item) => item.listId === currentListId && item.type === 'task'
      );
    }
    
    // Apply sorting
    if (sortMode === 'priority') {
      if (currentView === 'tasks') {
        // Sort by priority: now > high > low
        filteredItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
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
    }
    // If sortMode is 'custom', maintain the existing order (no sorting)
    
    return filteredItems;
  },
}));