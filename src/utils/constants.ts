// UI Animation and Timing
export const ANIMATION_DURATION = {
  FAST: 100,
  NORMAL: 300,
  SLOW: 500,
} as const;

// Layout Constants
export const LAYOUT = {
  SIDEBAR_WIDTH: 256, // w-64 in tailwind
  MODAL_MAX_WIDTH: 448, // max-w-md in tailwind
  NOTES_DEFAULT_HEIGHT: 300,
  DRAG_OFFSET_PADDING: 100,
} as const;

// Colors
export const COLORS = {
  PRIORITY: {
    NOW: '#FF0000',
    HIGH: '#FFA500', 
    LOW: '#00AA00',
  },
  DEFAULT_LIST: '#3B82F6',
  LIST_PALETTE: [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#14B8A6', // teal
    '#F97316', // orange
  ],
} as const;

// Common Styles
export const STYLES = {
  BUTTON: {
    GRAY: 'text-gray-700 hover:bg-gray-100 transition-colors',
    BLUE: 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700',
    RED: 'text-red-600 hover:bg-red-50 transition-colors',
  },
  MODAL: {
    BACKDROP: 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50',
    CONTENT: 'bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4',
  },
  CARD: {
    HOVER: 'hover:bg-gray-50',
    ACTIVE: 'bg-blue-100 text-blue-700',
  },
} as const;

// Debounce delays
export const DEBOUNCE_DELAY = {
  SEARCH: 300,
  AUTOSAVE: 2000,
} as const;