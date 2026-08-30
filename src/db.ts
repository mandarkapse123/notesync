import Dexie, { type Table } from 'dexie';
import { NoteItem, Topic, Tag } from './types';

class NotesSyncDatabase extends Dexie {
  notes!: Table<NoteItem, string>;
  topics!: Table<Topic, string>;
  tags!: Table<Tag, string>;

  constructor() {
    super('NotesSyncDB');
    this.version(1).stores({
      notes: 'id, title, createdAt, updatedAt, isReminder, reminderDate, isCompleted, priority, kanbanStatus, topicId, *tags',
      topics: 'id, title, createdAt',
      tags: 'id, name, lastUsedAt',
    });
  }
}

export const db = new NotesSyncDatabase();

// Seed initial default topics and welcome note ONCE only on first install
export async function seedInitialDataIfNeeded() {
  const SEED_KEY = 'notesync_initial_seed_completed_v2';
  if (localStorage.getItem(SEED_KEY)) {
    return;
  }

  const topicCount = await db.topics.count();
  if (topicCount === 0) {
    const defaultTopics: Topic[] = [
      { id: 'topic-work', title: 'Work', colorHex: '#007AFF', createdAt: Date.now() - 3000 },
      { id: 'topic-personal', title: 'Personal', colorHex: '#34C759', createdAt: Date.now() - 2000 },
      { id: 'topic-ideas', title: 'Ideas', colorHex: '#AF52DE', createdAt: Date.now() - 1000 },
    ];
    await db.topics.bulkAdd(defaultTopics);

    const defaultTags: Tag[] = [
      { id: 'tag-priority', name: 'priority', lastUsedAt: Date.now() },
      { id: 'tag-review', name: 'review', lastUsedAt: Date.now() - 1000 },
      { id: 'tag-voice', name: 'voice', lastUsedAt: Date.now() - 2000 },
    ];
    await db.tags.bulkAdd(defaultTags);
  }

  // Mark as seeded so welcome note never auto-respawns after being deleted!
  localStorage.setItem(SEED_KEY, 'true');
}

// Helpers for tag updates
export async function touchOrCreateTags(tagNames: string[]) {
  const now = Date.now();
  for (const rawName of tagNames) {
    const name = rawName.trim().toLowerCase().replace(/^#/, '');
    if (!name) continue;
    
    const existing = await db.tags.where('name').equals(name).first();
    if (existing) {
      await db.tags.update(existing.id, { lastUsedAt: now });
    } else {
      await db.tags.add({
        id: 'tag-' + Math.random().toString(36).substring(2, 9),
        name,
        lastUsedAt: now,
      });
    }
  }
}
