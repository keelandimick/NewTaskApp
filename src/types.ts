export type Priority = 'now' | 'high' | 'low';

export type TaskStatus = 'start' | 'in-progress' | 'complete';
export type ReminderStatus = '7plus' | 'within7' | 'today' | 'complete';

export interface Note {
  id: string;
  content: string;
  timestamp: Date;
}

export interface BaseItem {
  id: string;
  title: string;
  priority: Priority;
  notes: Note[];
  createdAt: Date;
  updatedAt: Date;
  listId: string;
  category?: string;
  recurrence?: RecurrenceSettings;
  metadata?: Record<string, any>;
  deletedAt?: Date;
  position?: number;
}

export interface Task extends BaseItem {
  type: 'task';
  status: TaskStatus;
}

export interface Reminder extends BaseItem {
  type: 'reminder';
  status: ReminderStatus;
  reminderDate?: Date;
  dueDate?: Date;
}

export type Item = Task | Reminder;

export interface List {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isLocked?: boolean;
  sharedWith?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export type ViewMode = 'tasks' | 'reminders' | 'recurring' | 'trash' | 'complete';
export type DisplayMode = 'column' | 'category';

export type RecurrenceFrequency = 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceSettings {
  frequency: RecurrenceFrequency;
  time: string; // HH:MM format, defaults to 09:00
  daysOfWeek?: number[]; // For weekly: 0 = Sunday, 6 = Saturday
  dayOfMonth?: number; // For monthly
  originalText?: string; // Store the original pattern text like "every other Thursday"
}