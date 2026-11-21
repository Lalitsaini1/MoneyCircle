import {useEffect, useRef} from 'react';
import {doc, serverTimestamp, setDoc} from 'firebase/firestore';
import {db, handleFirestoreError, makeSafeId, OperationType} from '../lib/firebase';
import {normalizePublicRoute} from '../lib/seo';
import type {Language, ThemeMode} from '../types/models';

const SESSION_STORAGE_KEY = 'mc_analytics_session';
const DEDUP_WINDOW_MS = 1500;
let memorySessionId: string | null = null;
const recentVisitTimestamps = new Map<string, number>();

function getAnalyticsSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{6,64}$/.test(existing)) {
      return existing;
    }
    const created = makeSafeId('sess').slice(0, 48);
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    if (!memorySessionId) {
      memorySessionId = makeSafeId('sess').slice(0, 48);
    }
    return memorySessionId;
  }
}

function getSafeReferrerHost(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const refUrl = new URL(document.referrer);
    if (!refUrl.hostname || refUrl.hostname === window.location.hostname) {
      return undefined;
    }
    return refUrl.hostname.slice(0, 120);
  } catch {
    return undefined;
  }
}

export function usePageAnalytics(params: {
  authReady: boolean;
  viewMode: 'landing' | 'user' | 'admin';
  pathname: string;
  lang: Language;
  theme: ThemeMode;
  userId?: string | null;
}): void {
  const {authReady, viewMode, pathname, lang, theme, userId} = params;
  const lastVisitRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authReady) return;

    const resolvedRoute =
      viewMode === 'admin'
        ? '/admin'
        : viewMode === 'user'
          ? '/dashboard'
          : normalizePublicRoute(pathname);

    const safeUserId =
      userId && /^[a-zA-Z0-9_-]{1,128}$/.test(userId) ? userId : undefined;
    const visitKey = `${viewMode}|${resolvedRoute}|${lang}|${safeUserId || 'anon'}`;

    if (lastVisitRef.current === visitKey) {
      return;
    }

    const nowMs = Date.now();
    const lastTimestamp = recentVisitTimestamps.get(visitKey) ?? 0;
    if (nowMs - lastTimestamp < DEDUP_WINDOW_MS) {
      lastVisitRef.current = visitKey;
      return;
    }

    lastVisitRef.current = visitKey;
    recentVisitTimestamps.set(visitKey, nowMs);

    const eventId = makeSafeId('pv').slice(0, 64);
    const referrerHost = getSafeReferrerHost();
    const payload: Record<string, unknown> = {
      id: eventId,
      eventType: 'PAGE_VIEW',
      route: resolvedRoute.slice(0, 128),
      viewMode,
      language: lang,
      theme,
      sessionId: getAnalyticsSessionId(),
      createdAt: serverTimestamp(),
      ...(safeUserId ? {userId: safeUserId} : {}),
      ...(referrerHost ? {referrerHost} : {}),
    };

    void (async () => {
      try {
        await setDoc(doc(db, 'analytics', eventId), payload);
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.CREATE, `analytics/${eventId}`);
        } catch {
          // Non-blocking telemetry: structured error logged by handleFirestoreError
        }
      }
    })();
  }, [authReady, viewMode, pathname, lang, theme, userId]);
}
