import { ReminderStatus } from '../types';

/**
 * Calculate the reminder status based on a given date
 */
export function calculateReminderStatus(reminderDate?: Date): ReminderStatus {
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
}

/**
 * Format a reminder date for display
 */
export function formatReminderDate(date: Date): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = dateOnly.getTime() - todayStart.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Constants for time calculations
 */
export const TIME_CONSTANTS = {
  MS_PER_DAY: 1000 * 60 * 60 * 24,
  MS_PER_HOUR: 1000 * 60 * 60,
  MS_PER_MINUTE: 1000 * 60,
} as const;