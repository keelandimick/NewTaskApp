# Store Migration Guide

## Overview
The store has been updated to integrate with Supabase for data persistence and real-time synchronization.

## Key Changes

### 1. New `useStoreWithAuth` Hook
- **Purpose**: Automatically handles user authentication and provides userId to store methods
- **Benefits**: 
  - Automatic data loading when user logs in
  - Real-time synchronization across devices
  - Simplified API (no need to pass userId)

### 2. Async Store Methods
All mutation methods are now async and return Promises:
- `addItem` → `async addItem`
- `updateItem` → `async updateItem`
- `deleteItem` → `async deleteItem`
- `moveItem` → `async moveItem`
- `addNote` → `async addNote`
- `addList` → `async addList`
- `updateList` → `async updateList`
- `deleteList` → `async deleteList`

### 3. Loading and Error States
The store now includes:
- `loading`: Boolean indicating if data is being loaded
- `error`: String with error message if operation fails

## Migration Steps

### Step 1: Update Imports
```typescript
// Old
import { useStore } from '../store/useStore';

// New
import { useStoreWithAuth } from '../store';
```

### Step 2: Update Hook Usage
```typescript
// Old
const store = useStore();

// New
const store = useStoreWithAuth();
```

### Step 3: Update Method Calls
```typescript
// Old
const itemId = store.addItem({
  title: 'New Task',
  type: 'task',
  priority: 'low',
  status: 'start',
  listId: store.currentListId,
});

// New
try {
  const itemId = await store.addItem({
    title: 'New Task',
    type: 'task',
    priority: 'low',
    status: 'start',
    listId: store.currentListId,
  });
} catch (error) {
  console.error('Failed to add item:', error);
}
```

### Step 4: Handle Loading States
```typescript
if (store.loading) {
  return <LoadingSpinner />;
}

if (store.error) {
  return <ErrorMessage message={store.error} />;
}
```

## Example Component Update

### Before
```typescript
import { useStore } from '../store/useStore';

function TaskList() {
  const { items, addItem, updateItem } = useStore();

  const handleAdd = () => {
    addItem({
      title: 'New Task',
      type: 'task',
      priority: 'low',
      status: 'start',
      listId: 'default',
    });
  };

  const handleComplete = (id: string) => {
    updateItem(id, { status: 'done' });
  };

  return (
    <div>
      {items.map(item => (
        <div key={item.id} onClick={() => handleComplete(item.id)}>
          {item.title}
        </div>
      ))}
      <button onClick={handleAdd}>Add Task</button>
    </div>
  );
}
```

### After
```typescript
import { useStoreWithAuth } from '../store';

function TaskList() {
  const { items, addItem, updateItem, loading, error } = useStoreWithAuth();

  const handleAdd = async () => {
    try {
      await addItem({
        title: 'New Task',
        type: 'task',
        priority: 'low',
        status: 'start',
        listId: 'default',
      });
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await updateItem(id, { status: 'done' });
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {items.map(item => (
        <div key={item.id} onClick={() => handleComplete(item.id)}>
          {item.title}
        </div>
      ))}
      <button onClick={handleAdd}>Add Task</button>
    </div>
  );
}
```

## Notes
- The store automatically loads data when a user logs in
- All changes are synced with Supabase in real-time
- The store subscribes to database changes for live updates across devices
- Error handling is now more important since operations can fail due to network issues