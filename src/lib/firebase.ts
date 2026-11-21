import {getApp, getApps, initializeApp, type FirebaseOptions} from 'firebase/app';
import {getAuth, GoogleAuthProvider} from 'firebase/auth';
import {doc, getDocFromServer, getFirestore} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const readEnv = (key: string): string => {
  const val = typeof import.meta !== 'undefined' ? (import.meta.env as Record<string, unknown>)?.[key] : undefined;
  return typeof val === 'string' ? val.trim() : '';
};

const readFirebaseEnv = (suffix: string): string =>
  readEnv(`VITE_FIREBASE_${suffix}`) ||
  readEnv(`NEXT_PUBLIC_FIREBASE_${suffix}`) ||
  readEnv(`REACT_APP_FIREBASE_${suffix}`);

const envProjectId = readFirebaseEnv('PROJECT_ID');
const envApiKey = readFirebaseEnv('API_KEY');
const envAuthDomain = readFirebaseEnv('AUTH_DOMAIN');
const envStorageBucket = readFirebaseEnv('STORAGE_BUCKET');
const envMessagingSenderId = readFirebaseEnv('MESSAGING_SENDER_ID');
const envAppId = readFirebaseEnv('APP_ID');
const envMeasurementId = readFirebaseEnv('MEASUREMENT_ID');
const envDatabaseId = readFirebaseEnv('FIRESTORE_DATABASE_ID');

const inferredProjectId =
  envProjectId ||
  (envAuthDomain &&
  envAuthDomain !== firebaseConfig.authDomain &&
  /\.firebaseapp\.com$/i.test(envAuthDomain)
    ? envAuthDomain.replace(/\.firebaseapp\.com$/i, '')
    : '');

const isExternalProject = Boolean(inferredProjectId && inferredProjectId !== firebaseConfig.projectId);

if (isExternalProject && !envApiKey) {
  console.error(
    `[Firebase Config] Firebase project is set to "${inferredProjectId}", but VITE_FIREBASE_API_KEY is missing. Set all VITE_FIREBASE_* variables from Firebase Console for "${inferredProjectId}".`,
  );
}

const resolvedProjectId = inferredProjectId || firebaseConfig.projectId;
const resolvedAuthDomain = isExternalProject
  ? envAuthDomain || `${resolvedProjectId}.firebaseapp.com`
  : envAuthDomain || firebaseConfig.authDomain;
const resolvedStorageBucket = isExternalProject
  ? envStorageBucket || `${resolvedProjectId}.firebasestorage.app`
  : envStorageBucket || firebaseConfig.storageBucket;
const resolvedMessagingSenderId = isExternalProject
  ? envMessagingSenderId
  : envMessagingSenderId || firebaseConfig.messagingSenderId;
const resolvedMeasurementId = isExternalProject
  ? envMeasurementId
  : envMeasurementId || firebaseConfig.measurementId;

const resolvedFirebaseConfig: FirebaseOptions = {
  apiKey: isExternalProject ? envApiKey : envApiKey || firebaseConfig.apiKey,
  authDomain: resolvedAuthDomain,
  projectId: resolvedProjectId,
  storageBucket: resolvedStorageBucket,
  ...(resolvedMessagingSenderId ? {messagingSenderId: resolvedMessagingSenderId} : {}),
  appId: isExternalProject ? envAppId : envAppId || firebaseConfig.appId,
  ...(resolvedMeasurementId ? {measurementId: resolvedMeasurementId} : {}),
};

const resolvedDatabaseId = isExternalProject
  ? envDatabaseId || '(default)'
  : envDatabaseId || firebaseConfig.firestoreDatabaseId || '(default)';

export const FIREBASE_PROJECT_ID = resolvedFirebaseConfig.projectId || firebaseConfig.projectId;
export const FIREBASE_AUTH_DOMAIN = resolvedFirebaseConfig.authDomain || firebaseConfig.authDomain;
export const FIREBASE_CONFIG_SOURCE: 'env' | 'firebase-applet-config.json' = isExternalProject
  ? 'env'
  : envApiKey || envAuthDomain || envAppId
    ? 'env'
    : 'firebase-applet-config.json';

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(resolvedFirebaseConfig);
export const db =
  resolvedDatabaseId && resolvedDatabaseId !== '(default)'
    ? getFirestore(firebaseApp, resolvedDatabaseId)
    : getFirestore(firebaseApp);
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
