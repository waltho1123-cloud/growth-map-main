// Firebase web config — these values are PUBLIC by design.
// Real security is enforced by Firestore security rules, not by hiding this.
// Get these from Firebase Console → Project Settings → General → Your apps → Web app.
export const firebaseConfig = {
  apiKey: 'AIzaSyANpkc1-X1-1VMiPjZLkw_2CeOhc2BVzfk',
  authDomain: 'growth-map-main.firebaseapp.com',
  projectId: 'growth-map-main',
  storageBucket: 'growth-map-main.firebasestorage.app',
  messagingSenderId: '421192696889',
  appId: '1:421192696889:web:ea0d2b14a63709207c79e8',
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== 'REPLACE_ME';
