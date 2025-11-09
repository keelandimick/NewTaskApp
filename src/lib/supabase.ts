import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      lists: {
        Row: {
          id: string;
          name: string;
          color: string;
          icon: string | null;
          is_locked: boolean;
          shared_with: string[] | null;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          color: string;
          icon?: string | null;
          is_locked?: boolean;
          shared_with?: string[] | null;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          icon?: string | null;
          is_locked?: boolean;
          shared_with?: string[] | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
      items: {
        Row: {
          id: string;
          title: string;
          type: 'task' | 'reminder';
          priority: 'now' | 'high' | 'low';
          status: string;
          list_id: string;
          reminder_date: string | null;
          due_date: string | null;
          recurrence_settings: any | null;
          metadata: any | null;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          title: string;
          type: 'task' | 'reminder';
          priority: 'now' | 'high' | 'low';
          status: string;
          list_id: string;
          reminder_date?: string | null;
          due_date?: string | null;
          recurrence_settings?: any | null;
          metadata?: any | null;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          title?: string;
          type?: 'task' | 'reminder';
          priority?: 'now' | 'high' | 'low';
          status?: string;
          list_id?: string;
          reminder_date?: string | null;
          due_date?: string | null;
          recurrence_settings?: any | null;
          metadata?: any | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
      notes: {
        Row: {
          id: string;
          content: string;
          item_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          content: string;
          item_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          content?: string;
          item_id?: string;
          created_at?: string;
          user_id?: string;
        };
      };
    };
  };
};