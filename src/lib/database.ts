import { supabase, Database } from './supabase';
import { Item, List, Note, RecurrenceSettings } from '../types';

type DbItem = Database['public']['Tables']['items']['Row'];
type DbList = Database['public']['Tables']['lists']['Row'];
type DbNote = Database['public']['Tables']['notes']['Row'];

export const db = {
  // Lists
  async getLists(userId: string): Promise<List[]> {
    // Get user's email first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get lists where user is owner OR in sharedWith array
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .or(`user_id.eq.${userId},shared_with.cs.{${user.email}}`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data.map(dbListToList);
  },

  async createList(list: Omit<List, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<List> {
    const { data, error } = await supabase
      .from('lists')
      .insert({
        name: list.name,
        color: list.color,
        icon: list.icon,
        is_locked: list.isLocked,
        shared_with: list.sharedWith,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return dbListToList(data);
  },

  async updateList(id: string, updates: Partial<List>, userId: string): Promise<void> {
    // First check if user has access (owner or collaborator)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: list, error: fetchError } = await supabase
      .from('lists')
      .select('*')
      .eq('id', id)
      .or(`user_id.eq.${userId},shared_with.cs.{${user.email}}`)
      .single();

    if (fetchError || !list) throw new Error('List not found or access denied');

    // Now update the list
    const { error } = await supabase
      .from('lists')
      .update({
        name: updates.name,
        color: updates.color,
        icon: updates.icon,
        is_locked: updates.isLocked,
        shared_with: updates.sharedWith,
      })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteList(id: string, userId: string): Promise<void> {
    // Only the owner can delete a list
    const { error } = await supabase
      .from('lists')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  // Items
  async getItems(userId: string): Promise<Item[]> {
    // First get all lists the user has access to (owned + shared)
    const lists = await this.getLists(userId);
    const listIds = lists.map(l => l.id);
    
    if (listIds.length === 0) return [];

    // Get items from all accessible lists
    const { data, error } = await supabase
      .from('items')
      .select('*, notes(*)')
      .in('list_id', listIds)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data.map(dbItemToItem);
  },

  async createItem(item: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'notes'>, userId: string): Promise<Item> {
    const { data, error } = await supabase
      .from('items')
      .insert({
        title: item.title,
        type: item.type,
        priority: item.priority,
        status: 'status' in item ? item.status : 'start',
        list_id: item.listId,
        reminder_date: 'reminderDate' in item && item.reminderDate ? (item.reminderDate as Date).toISOString() : null,
        due_date: 'dueDate' in item && item.dueDate ? (item.dueDate as Date).toISOString() : null,
        recurrence_settings: item.recurrence,
        metadata: item.metadata,
        user_id: userId,
      })
      .select('*, notes(*)')
      .single();

    if (error) throw error;

    return dbItemToItem(data);
  },

  async updateItem(id: string, updates: Partial<Item>, userId: string): Promise<void> {
    // First check if user has access to this item's list
    const { data: item } = await supabase
      .from('items')
      .select('list_id')
      .eq('id', id)
      .single();
    
    if (!item) throw new Error('Item not found');
    
    // Verify user has access to this list
    const lists = await this.getLists(userId);
    if (!lists.some(l => l.id === item.list_id)) {
      throw new Error('Access denied');
    }

    const updateData: any = {};
    
    if ('title' in updates) updateData.title = updates.title;
    if ('type' in updates) updateData.type = updates.type;
    if ('priority' in updates) updateData.priority = updates.priority;
    if ('status' in updates) updateData.status = updates.status;
    if ('listId' in updates) updateData.list_id = updates.listId;
    if ('reminderDate' in updates) updateData.reminder_date = updates.reminderDate?.toISOString();
    if ('dueDate' in updates) updateData.due_date = updates.dueDate?.toISOString();
    if ('recurrence' in updates) updateData.recurrence_settings = updates.recurrence;
    if ('metadata' in updates) updateData.metadata = updates.metadata;
    if ('deletedAt' in updates) updateData.deleted_at = updates.deletedAt ? updates.deletedAt.toISOString() : null;
    if ('position' in updates) updateData.position = updates.position;

    const { error } = await supabase
      .from('items')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteItem(id: string, userId: string): Promise<void> {
    // First check if user has access to this item's list
    const { data: item } = await supabase
      .from('items')
      .select('list_id')
      .eq('id', id)
      .single();
    
    if (!item) throw new Error('Item not found');
    
    // Verify user has access to this list
    const lists = await this.getLists(userId);
    if (!lists.some(l => l.id === item.list_id)) {
      throw new Error('Access denied');
    }

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Notes
  async addNote(itemId: string, content: string, userId: string): Promise<Note> {
    const { data, error } = await supabase
      .from('notes')
      .insert({
        item_id: itemId,
        content,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return dbNoteToNote(data);
  },

  // Auth
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Check if users exist by email
  async checkUsersExist(emails: string[]): Promise<{ email: string; exists: boolean }[]> {
    const { data, error } = await supabase
      .rpc('check_users_exist', { emails });

    if (error) throw error;
    
    // Map user_exists to exists for consistency
    return (data || []).map((item: { email: string; user_exists: boolean }) => ({
      email: item.email,
      exists: item.user_exists
    }));
  },
};

// Conversion helpers
function dbListToList(dbList: DbList): List {
  return {
    id: dbList.id,
    name: dbList.name,
    color: dbList.color,
    icon: dbList.icon || undefined,
    isLocked: dbList.is_locked,
    sharedWith: dbList.shared_with || undefined,
    createdAt: new Date(dbList.created_at),
    updatedAt: new Date(dbList.updated_at),
  };
}

function dbItemToItem(dbItem: DbItem & { notes?: DbNote[] }): Item {
  const base = {
    id: dbItem.id,
    title: dbItem.title,
    priority: dbItem.priority,
    notes: dbItem.notes?.map(dbNoteToNote) || [],
    createdAt: new Date(dbItem.created_at),
    updatedAt: new Date(dbItem.updated_at),
    listId: dbItem.list_id,
    recurrence: dbItem.recurrence_settings as RecurrenceSettings | undefined,
    metadata: dbItem.metadata || undefined,
    deletedAt: dbItem.deleted_at ? new Date(dbItem.deleted_at) : undefined,
    position: (dbItem as any).position || undefined,
  };

  if (dbItem.type === 'task') {
    return {
      ...base,
      type: 'task',
      status: dbItem.status as any,
    };
  } else {
    return {
      ...base,
      type: 'reminder',
      status: dbItem.status as any,
      reminderDate: dbItem.reminder_date ? new Date(dbItem.reminder_date) : undefined,
      dueDate: dbItem.due_date ? new Date(dbItem.due_date) : undefined,
    };
  }
}

function dbNoteToNote(dbNote: DbNote): Note {
  return {
    id: dbNote.id,
    content: dbNote.content,
    timestamp: new Date(dbNote.created_at),
  };
}