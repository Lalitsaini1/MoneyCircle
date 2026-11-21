import {getApp, getApps, initializeApp, type FirebaseOptions} from 'firebase/app';
import {getAuth, GoogleAuthProvider} from 'firebase/auth';
import {doc, getDocFromServer, getFirestore} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const readEnv = (key: string): string => {
  const val = typeof import.meta !== 'undefined' ? import.meta.env?.[key] : undefined;
  return typeof val === 'string' ? val.trim() : '';
};

const resolvedFirebaseConfig: FirebaseOptions = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY') || firebaseConfig.apiKey,
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN') || firebaseConfig.authDomain,
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID') || firebaseConfig.projectId,
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET') || firebaseConfig.storageBucket,
  messagingSenderId:
    readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || firebaseConfig.messagingSenderId,
  appId: readEnv('VITE_FIREBASE_APP_ID') || firebaseConfig.appId,
  ...(readEnv('VITE_FIREBASE_MEASUREMENT_ID') || firebaseConfig.measurementId
    ? {measurementId: readEnv('VITE_FIREBASE_MEASUREMENT_ID') || firebaseConfig.measurementId}
    : {}),
};

const resolvedDatabaseId =
  readEnv('VITE_FIREBASE_FIRESTORE_DATABASE_ID') || firebaseConfig.firestoreDatabaseId;

export const FIREBASE_PROJECT_ID = resolvedFirebaseConfig.projectId || firebaseConfig.projectId;
export const FIREBASE_AUTH_DOMAIN = resolvedFirebaseConfig.authDomain || firebaseConfig.authDomain;

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(resolvedFirebaseConfig);
export const db = getFirestore(firebaseApp, resolvedDatabaseId);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({prompt: 'select_account'});

export const BOOTSTRAP_ADMIN_EMAIL = 'saini.lalit278@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
    }
  }
}

export function makeSafeId(prefix = 'mc'): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}
