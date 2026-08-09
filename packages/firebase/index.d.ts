import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

export declare const firebaseConfig: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export declare const isFirebaseConfigured: boolean;

export declare function getFirebase(): Promise<{
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
}>;

export declare function signInWithGoogle(): Promise<User | null>;

export declare function signOut(): Promise<void>;

export declare function useAuth(): { user: User | null; loading: boolean };
