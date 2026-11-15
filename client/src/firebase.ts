import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

type PublicFirebaseConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

type PublicRuntimeConfig = {
  firebaseConfig?: PublicFirebaseConfig;
};

const runtimeConfig = (window as Window & { __MANUS_CONFIG__?: PublicRuntimeConfig }).__MANUS_CONFIG__;

// Prefer runtime config served by the app server. Vite env remains a fallback for local builds.
const firebaseConfig = {
  apiKey: runtimeConfig?.firebaseConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: runtimeConfig?.firebaseConfig?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: runtimeConfig?.firebaseConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: runtimeConfig?.firebaseConfig?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: runtimeConfig?.firebaseConfig?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: runtimeConfig?.firebaseConfig?.appId || import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = Object.values(firebaseConfig).every(value => typeof value === "string" && value.length > 0);
export const firebaseEnabled = isConfigured;
export const firebaseAuth = isConfigured
  ? getAuth(getApps().length ? getApps()[0] : initializeApp(firebaseConfig))
  : null;
