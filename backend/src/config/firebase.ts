import admin from "firebase-admin";
import { env, isFirebaseConfigured, isProduction } from "./env";

function unavailableFirebaseService<T>(serviceName: string): T {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          `Firebase ${serviceName} is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and FIREBASE_STORAGE_BUCKET.`
        );
      }
    }
  ) as T;
}

if (isFirebaseConfigured) {
  const privateKey = env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n");

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
} else if (!isProduction) {
  console.warn(
    "Firebase Admin is not configured. The server will start, but Firebase-backed routes require FIREBASE_* environment variables."
  );
} else {
  throw new Error("Firebase Admin is not configured.");
}

export const firebaseAdmin = admin;
export const firestore = isFirebaseConfigured
  ? admin.firestore()
  : unavailableFirebaseService<admin.firestore.Firestore>("Firestore");
export const storage = isFirebaseConfigured
  ? admin.storage()
  : unavailableFirebaseService<admin.storage.Storage>("Storage");
export const auth = isFirebaseConfigured
  ? admin.auth()
  : unavailableFirebaseService<admin.auth.Auth>("Auth");
