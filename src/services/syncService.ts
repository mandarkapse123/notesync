import { getFirebaseDb } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '../db';
import { NoteItem, Topic, Tag } from '../types';

// Helper: Convert Blob to Base64 String for zero-cost Firestore storage
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper: Convert Base64 data URL to Blob
async function base64ToBlob(base64: string): Promise<Blob> {
  const res = await fetch(base64);
  return await res.blob();
}

export class SyncService {
  private isSyncing = false;
  private onSyncStatusCallbacks: ((isSyncing: boolean) => void)[] = [];
  private firestoreUnsubscribes: Unsubscribe[] = [];
  private isInitialized = false;

  public getSyncing() {
    return this.isSyncing;
  }

  public onSyncStatus(cb: (isSyncing: boolean) => void) {
    this.onSyncStatusCallbacks.push(cb);
    return () => {
      this.onSyncStatusCallbacks = this.onSyncStatusCallbacks.filter((c) => c !== cb);
    };
  }

  private setSyncing(state: boolean) {
    this.isSyncing = state;
    this.onSyncStatusCallbacks.forEach((cb) => cb(state));
  }

  private flashSyncStatus() {
    this.setSyncing(true);
    setTimeout(() => {
      this.setSyncing(false);
    }, 500);
  }

  // Push Note changes directly to Firestore
  public async syncNote(note: NoteItem) {
    const firestore = getFirebaseDb();
    if (!firestore) return;

    try {
      this.setSyncing(true);
      let audioBase64 = note.audioUrl;

      if (note.audioBlob && (!audioBase64 || audioBase64.startsWith('blob:'))) {
        audioBase64 = await blobToBase64(note.audioBlob);
        await db.notes.update(note.id, { audioUrl: audioBase64 });
      }

      const noteRef = doc(firestore, 'notes', note.id);
      const payload: Record<string, any> = {
        id: String(note.id),
        title: String(note.title || ''),
        bodyText: String(note.bodyText || ''),
        createdAt: Number(note.createdAt || Date.now()),
        updatedAt: Number(note.updatedAt || Date.now()),
        isReminder: Boolean(note.isReminder),
        reminderDate: note.reminderDate ? Number(note.reminderDate) : null,
        isCompleted: Boolean(note.isCompleted),
        priority: String(note.priority || 'Medium'),
        kanbanStatus: String(note.kanbanStatus || 'To-Do'),
        topicId: note.topicId ? String(note.topicId) : null,
        tags: Array.isArray(note.tags) ? note.tags : [],
        audioDuration: Number(note.audioDuration || 0),
      };

      if (audioBase64) {
        payload.audioUrl = audioBase64;
      }

      await setDoc(noteRef, payload, { merge: true });
    } catch (err: any) {
      console.error('Failed to sync note to Firestore:', err);
    } finally {
      this.flashSyncStatus();
    }
  }

  // Delete note in Firestore & record tombstone to prevent resurrection from other devices
  public async deleteNote(id: string) {
    const firestore = getFirebaseDb();
    if (!firestore) return;

    try {
      this.setSyncing(true);
      // 1. Record tombstone so other devices never re-upload this note
      await setDoc(doc(firestore, 'deleted_notes', id), {
        id,
        deletedAt: Date.now(),
      });
      // 2. Delete the note from Firestore
      await deleteDoc(doc(firestore, 'notes', id));
    } catch (err) {
      console.error('Failed to delete note from Firestore:', err);
    } finally {
      this.flashSyncStatus();
    }
  }

  // Sync Topic changes
  public async syncTopic(topic: Topic) {
    const firestore = getFirebaseDb();
    if (!firestore) return;

    try {
      await setDoc(doc(firestore, 'topics', topic.id), {
        id: String(topic.id),
        title: String(topic.title || ''),
        colorHex: String(topic.colorHex || '#007AFF'),
        createdAt: Number(topic.createdAt || Date.now()),
      }, { merge: true });
    } catch (err) {
      console.error('Failed to sync topic to Firestore:', err);
    }
  }

  // Delete Topic in Firestore
  public async deleteTopic(id: string) {
    const firestore = getFirebaseDb();
    if (!firestore) return;

    try {
      await deleteDoc(doc(firestore, 'topics', id));
    } catch (err) {
      console.error('Failed to delete topic from Firestore:', err);
    }
  }

  // Sync Tag changes
  public async syncTag(tag: Tag) {
    const firestore = getFirebaseDb();
    if (!firestore) return;

    try {
      await setDoc(doc(firestore, 'tags', tag.id), {
        id: String(tag.id),
        name: String(tag.name || ''),
        lastUsedAt: Number(tag.lastUsedAt || Date.now()),
      }, { merge: true });
    } catch (err) {
      console.error('Failed to sync tag to Firestore:', err);
    }
  }

  // Setup Real-time Listeners and Two-Way Reconciliation
  public async pullAll(): Promise<boolean> {
    const firestore = getFirebaseDb();
    if (!firestore) {
      return false;
    }

    this.setSyncing(true);

    try {
      // 0. Fetch Tombstones (deleted notes)
      const deletedSnap = await getDocs(collection(firestore, 'deleted_notes'));
      const deletedIds = new Set<string>();
      deletedSnap.forEach((d) => deletedIds.add(d.id));

      // Clean local deleted notes immediately
      for (const delId of deletedIds) {
        await db.notes.delete(delId);
      }

      // 1. Reconcile Topics
      const topicsSnap = await getDocs(collection(firestore, 'topics'));
      const remoteTopics: Topic[] = [];
      topicsSnap.forEach((d) => remoteTopics.push(d.data() as Topic));
      
      if (remoteTopics.length > 0) {
        await db.topics.bulkPut(remoteTopics);
      }

      const localTopics = await db.topics.toArray();
      for (const t of localTopics) {
        const found = remoteTopics.some((r) => r.id === t.id);
        if (!found) {
          await this.syncTopic(t);
        }
      }

      // 2. Reconcile Tags
      const tagsSnap = await getDocs(collection(firestore, 'tags'));
      const remoteTags: Tag[] = [];
      tagsSnap.forEach((d) => remoteTags.push(d.data() as Tag));
      if (remoteTags.length > 0) {
        await db.tags.bulkPut(remoteTags);
      }

      // 3. Reconcile Notes
      const notesSnap = await getDocs(collection(firestore, 'notes'));
      const remoteNotes: NoteItem[] = [];
      const remoteIds = new Set<string>();

      for (const d of notesSnap.docs) {
        if (deletedIds.has(d.id)) {
          // If in deleted set, remove from remote too
          await deleteDoc(doc(firestore, 'notes', d.id));
          continue;
        }

        remoteIds.add(d.id);
        const data = d.data() as any;
        let audioBlob: Blob | undefined = undefined;
        if (data.audioUrl && data.audioUrl.startsWith('data:')) {
          try {
            audioBlob = await base64ToBlob(data.audioUrl);
          } catch (e) {}
        }
        remoteNotes.push({
          ...data,
          audioBlob,
        });
      }

      // Save valid remote notes in local db
      if (remoteNotes.length > 0) {
        await db.notes.bulkPut(remoteNotes);
      }

      // Delete any local notes that were deleted in Firestore, or upload genuine new local notes
      const localNotes = await db.notes.toArray();
      for (const local of localNotes) {
        if (deletedIds.has(local.id)) {
          await db.notes.delete(local.id);
        } else if (!remoteIds.has(local.id)) {
          // Only upload if it's a genuinely newly created note, not an old deleted note
          if (local.id !== 'welcome-note') {
            await this.syncNote(local);
          } else {
            await db.notes.delete(local.id);
          }
        }
      }

      // 4. Setup REALTIME LISTENERS
      if (!this.isInitialized) {
        this.firestoreUnsubscribes.forEach((unsub) => unsub());
        this.firestoreUnsubscribes = [];

        // Realtime Notes Listener
        const unsubNotes = onSnapshot(
          collection(firestore, 'notes'), 
          (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
              const data = change.doc.data() as any;
              if (change.type === 'added' || change.type === 'modified') {
                let audioBlob: Blob | undefined = undefined;
                if (data.audioUrl && data.audioUrl.startsWith('data:')) {
                  try {
                    audioBlob = await base64ToBlob(data.audioUrl);
                  } catch (e) {}
                }
                await db.notes.put({ ...data, audioBlob });
              } else if (change.type === 'removed') {
                await db.notes.delete(change.doc.id);
              }
            });
            this.flashSyncStatus();
          },
          (err) => {
            console.error('Firestore Notes onSnapshot error:', err);
          }
        );
        this.firestoreUnsubscribes.push(unsubNotes);

        // Realtime Deleted Notes Tombstone Listener
        const unsubDeleted = onSnapshot(
          collection(firestore, 'deleted_notes'),
          (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
              if (change.type === 'added' || change.type === 'modified') {
                await db.notes.delete(change.doc.id);
              }
            });
          }
        );
        this.firestoreUnsubscribes.push(unsubDeleted);

        // Realtime Topics Listener
        const unsubTopics = onSnapshot(
          collection(firestore, 'topics'), 
          (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
              const data = change.doc.data() as Topic;
              if (change.type === 'added' || change.type === 'modified') {
                await db.topics.put(data);
              } else if (change.type === 'removed') {
                await db.topics.delete(change.doc.id);
              }
            });
          }
        );
        this.firestoreUnsubscribes.push(unsubTopics);

        this.isInitialized = true;
      }

      return true;
    } catch (err: any) {
      console.error('Firebase pullAll error:', err);
      return false;
    } finally {
      this.flashSyncStatus();
    }
  }
}

export const syncService = new SyncService();
