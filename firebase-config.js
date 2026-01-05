// Firebase Configuration
// API Key visible to client is standard for Firebase. Security is handled by Firestore Rules.
const firebaseConfig = {
    apiKey: "AIzaSyDi5xNPDSKMQUVOMO8ocU3f4EHImbo81eA",
    authDomain: "vrc-kaiben-log-1a83a.firebaseapp.com",
    projectId: "vrc-kaiben-log-1a83a",
    storageBucket: "vrc-kaiben-log-1a83a.firebasestorage.app",
    messagingSenderId: "841018825464",
    appId: "1:841018825464:web:bb24e90555a729b412390d"
};

// Expose config to global scope so app.js can use it with the Compat SDK
window.firebaseConfig = firebaseConfig;
