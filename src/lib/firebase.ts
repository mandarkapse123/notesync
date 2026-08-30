import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, getDocs, limit, query } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId?: string;
  appId: string;
}

// Your default Firebase project configuration (Auto-connects on all devices without typing!)
const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: "AIzaSyAZZ4EJ0TOFYQrtIA73kAcbqlcT8rmQ3Q0",
  authDomain: "notesync-414db.firebaseapp.com",
  projectId: "notesync-414db",
  storageBucket: "notesync-414db.firebasestorage.app",
  messagingSenderId: "668237567618",
  appId: "1:668237567618:web:04cfe7f6d98c1b06bc869b"
};

const STORAGE_KEY_CONFIG = 'notesync_firebase_config';

export function getStoredFirebaseConfig(): FirebaseConfig | null {
  // 1. Check if user overrode with custom config in localStorage
  const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Invalid stored Firebase config', e);
    }
  }

  // 2. Check environment variables
  const envKey = (import.meta as any).env?.VITE_FIREBASE_API_KEY;
  const envProjectId = (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID;

  if (envKey && envProjectId) {
    return {
      apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || '',
      authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || '',
    };
  }

  // 3. Default to your pre-configured Firebase project automatically!
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveFirebaseConfig(config: FirebaseConfig | null) {
  if (config && config.apiKey && config.projectId) {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } else {
    localStorage.removeItem(STORAGE_KEY_CONFIG);
  }

  appInstance = null;
  dbInstance = null;
  storageInstance = null;
}

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (appInstance) return appInstance;

  const config = getStoredFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) return null;

  try {
    if (getApps().length > 0) {
      appInstance = getApp();
    } else {
      appInstance = initializeApp(config);
    }
    return appInstance;
  } catch (err) {
    console.error('Firebase initialization error:', err);
    return null;
  }
}

export function getFirebaseDb(): Firestore | null {
  if (dbInstance) return dbInstance;
  const app = getFirebaseApp();
  if (!app) return null;

  try {
    dbInstance = getFirestore(app);
    return dbInstance;
  } catch (err) {
    console.error('Firestore init error:', err);
    return null;
  }
}

export function getFirebaseStorage(): FirebaseStorage | null {
  if (storageInstance) return storageInstance;
  const app = getFirebaseApp();
  if (!app) return null;

  try {
    storageInstance = getStorage(app);
    return storageInstance;
  } catch (err) {
    console.error('Firebase Storage init error:', err);
    return null;
  }
}

export async function testFirebaseConnection(config: FirebaseConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const tempApp = initializeApp(config, 'temp-test-app-' + Date.now());
    const tempDb = getFirestore(tempApp);
    const q = query(collection(tempDb, 'topics'), limit(1));
    await getDocs(q);
    return { ok: true, message: 'Connected to Firebase Firestore successfully! 🚀' };
  } catch (err: any) {
    console.warn('Firebase test connection error:', err);
    return { ok: false, message: err.message || 'Could not connect to Firestore.' };
  }
}
