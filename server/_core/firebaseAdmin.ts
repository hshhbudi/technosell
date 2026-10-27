import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { ENV } from "./env";

let firebaseApp: App | null = null;

function getFirebaseApp(): App {
  if (firebaseApp) return firebaseApp;
  if (getApps().length) {
    firebaseApp = getApps()[0]!;
    return firebaseApp;
  }
  if (!ENV.firebaseProjectId || !ENV.firebaseClientEmail || !ENV.firebasePrivateKey) {
    throw new Error("Firebase server credentials are not configured");
  }
  firebaseApp = initializeApp({
    credential: cert({
      projectId: ENV.firebaseProjectId,
      clientEmail: ENV.firebaseClientEmail,
      privateKey: ENV.firebasePrivateKey.replace(/\\n/g, "\n"),
    }),
  });
  return firebaseApp;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  if (!idToken.trim()) throw new Error("Firebase ID token is empty");
  return getAuth(getFirebaseApp()).verifyIdToken(idToken, true);
}
