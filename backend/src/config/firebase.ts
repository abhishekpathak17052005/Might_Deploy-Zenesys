import admin from "firebase-admin";
import { env } from "./env";

const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey
      }),
      storageBucket: env.FIREBASE_STORAGE_BUCKET
    });
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown Firebase initialization error";
  throw new Error(`Firebase Admin initialization failed: ${message}`);
}

export const firebaseAdmin = admin;
export const firestore = admin.firestore();
export const storage = admin.storage();
export const auth = admin.auth();
