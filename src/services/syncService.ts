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

  // Push Note changes to Firestore
  public async syncNote(note: NoteItem) {
    const firestore = getFirebaseDb();
    if (!firestore) {
      console.warn('Cannot sync note: Firestore not initialized');
      return;
    }

    try {
      this.setSyncing(true);
      let audioBase64 = note.audioUrl;

      // If note has a raw audioBlob, convert to Base64 data URL
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
      console.log('Successfully synced note to Firestore:', note.id);
    } catch (err: any) {
      console.error('Failed to sync note to Firestore:', err);
      if (err?.code === 'permission-denied') {
        alert('Firebase Permission Error: Please ensure Firestore rules are set to "allow read, write: if true;" in Firebase Console -> Firestore Database -> Rules tab.');
      }
    } finally {
      this.setSyncing(false);
    }
  }

  // Delete note in Firestore
  public async deleteNote(id: string) {
    const firestore = getFirebaseDb();
    if (!firestore) return;

    try {
      this.setSyncing(true);
      await deleteDoc(doc(firestore, 'notes', id));
      console.log('Deleted note from Firestore:', id);
    } catch (err) {
      console.error('Failed to delete note from Firestore:', err);
    } finally {
      this.setSyncing(false);
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

  // Initial pull and setup real-time listeners for live multi-device synchronization
  public async pullAll(): Promise<boolean> {
    const firestore = getFirebaseDb();
    if (!firestore) {
      console.warn('Firestore not ready for pullAll');
      return false;
    }

    this.setSyncing(true);

    // Clean up old listeners if re-connecting
    this.firestoreUnsubscribes.forEach((unsub) => unsub());
    this.firestoreUnsubscribes = [];

    try {
      // 1. Initial Topics pull
      const topicsSnap = await getDocs(collection(firestore, 'topics'));
      const remoteTopics: Topic[] = [];
      topicsSnap.forEach((d) => remoteTopics.push(d.data() as Topic));
      if (remoteTopics.length > 0) {
        await db.topics.bulkPut(remoteTopics);
      } else {
        const localTopics = await db.topics.toArray();
        for (const t of localTopics) {
          await this.syncTopic(t);
        }
      }

      // 2. Initial Tags pull
      const tagsSnap = await getDocs(collection(firestore, 'tags'));
      const remoteTags: Tag[] = [];
      tagsSnap.forEach((d) => remoteTags.push(d.data() as Tag));
      if (remoteTags.length > 0) {
        await db.tags.bulkPut(remoteTags);
      }

      // 3. Initial Notes pull
      const notesSnap = await getDocs(collection(firestore, 'notes'));
      const remoteNotes: NoteItem[] = [];
      for (const d of notesSnap.docs) {
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

      if (remoteNotes.length > 0) {
        await db.notes.bulkPut(remoteNotes);
      } else {
        const localNotes = await db.notes.toArray();
        for (const n of localNotes) {
          await this.syncNote(n);
        }
      }

      // 4. REALTIME LISTENERS: Automatically updates whenever a note is created/edited on iPhone!
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
        },
        (err) => {
          console.error('Firestore Notes onSnapshot error:', err);
        }
      );
      this.firestoreUnsubscribes.push(unsubNotes);

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
        },
        (err) => {
          console.error('Firestore Topics onSnapshot error:', err);
        }
      );
      this.firestoreUnsubscribes.push(unsubTopics);

      console.log('Firebase Realtime sync active! 🚀');
      return true;
    } catch (err: any) {
      console.error('Firebase pullAll error:', err);
      if (err?.code === 'permission-denied') {
        alert('Firebase Permission Error: Please ensure Firestore rules are set to "allow read, write: if true;" in Firebase Console -> Firestore Database -> Rules tab.');
      }
      return false;
    } finally {
      this.setSyncing(false);
    }
  }
}

export const syncService = new SyncService();
