// Firebase web config — these values are PUBLIC by design.
// Real security is enforced by Firestore security rules, not by hiding this.
// Get these from Firebase Console → Project Settings → General → Your apps → Web app.
export const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== 'REPLACE_ME';
