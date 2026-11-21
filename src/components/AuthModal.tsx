import React, {useState} from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {AlertCircle, CheckCircle2, Mail, Shield, X} from 'lucide-react';
import {auth, googleProvider} from '../lib/firebase';
import {getActiveSiteOrigin, getAuthActionCodeSettings} from '../lib/siteConfig';
import type {Language} from '../types/models';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'login' | 'register' | 'forgot';
  lang: Language;
  initialReferralCode?: string;
  onClose: () => void;
  onReferralCodeCapture: (code: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  lang,
  initialReferralCode = '',
  onClose,
  onReferralCodeCapture,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralInput, setReferralInput] = useState(initialReferralCode);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  React.useEffect(() => {
    setMode(initialMode);
    setErrorMsg('');
    setInfoMsg('');
    if (initialReferralCode) {
      setReferralInput(initialReferralCode);
    }
  }, [initialMode, isOpen, initialReferralCode]);

  if (!isOpen) return null;

  const formatFirebaseAuthError = (err: unknown): string => {
    const code = (err as {code?: string})?.code || '';
    if (code === 'auth/operation-not-allowed') {
      return lang === 'hi'
        ? 'ईमेल/पासवर्ड साइन-इन Firebase Console में सक्षम नहीं है। कृपया Google साइन-इन का उपयोग करें या Firebase Console → Authentication → Sign-in method में Email/Password सक्षम करें।'
        : 'Email/Password sign-in is not yet enabled in Firebase Console. Use "Continue with Google" below, or enable Email/Password under Firebase Console → Authentication → Sign-in method.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return lang === 'hi' ? 'साइन-इन पॉपअप बंद कर दिया गया।' : 'Sign-in popup was closed before completion.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return lang === 'hi' ? 'अमान्य ईमेल या पासवर्ड।' : 'Invalid email or password.';
    }
    if (code === 'auth/email-already-in-use') {
      return lang === 'hi' ? 'यह ईमेल पहले से पंजीकृत है।' : 'An account with this email already exists.';
    }
    if (code === 'auth/weak-password') {
      return lang === 'hi' ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।' : 'Password must be at least 6 characters.';
    }
    return err instanceof Error ? err.message : 'Authentication failed.';
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      if (referralInput.trim()) {
        onReferralCodeCapture(referralInput.trim().toUpperCase());
      }
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      if (referralInput.trim()) {
        onReferralCodeCapture(referralInput.trim().toUpperCase());
      }
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onClose();
      } else if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(cred.user, {displayName: displayName.trim()});
        }
        try {
          await sendEmailVerification(cred.user, getAuthActionCodeSettings('authAction=verified'));
        } catch (verifyErr) {
          if ((verifyErr as {code?: string})?.code === 'auth/unauthorized-continue-uri') {
            await sendEmailVerification(
              cred.user,
              getAuthActionCodeSettings('authAction=verified', getActiveSiteOrigin()),
            );
          } else {
            throw verifyErr;
          }
        }
        setInfoMsg(
          lang === 'hi'
            ? 'खाता बन गया! कृपया अपना ईमेल सत्यापित करें।'
            : 'Account created! A verification link has been sent to your email.',
        );
        onClose();
      } else {
        try {
          await sendPasswordResetEmail(auth, email.trim(), getAuthActionCodeSettings('authAction=reset'));
        } catch (resetErr) {
          if ((resetErr as {code?: string})?.code === 'auth/unauthorized-continue-uri') {
            await sendPasswordResetEmail(
              auth,
              email.trim(),
              getAuthActionCodeSettings('authAction=reset', getActiveSiteOrigin()),
            );
          } else {
            throw resetErr;
          }
        }
        setInfoMsg(
          lang === 'hi'
            ? 'पासवर्ड रीसेट लिंक आपके ईमेल पर भेजा गया है।'
            : 'Password reset link sent to your email address.',
        );
      }
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
              {mode === 'login'
                ? lang === 'hi'
                  ? 'MoneyCircle में साइन इन करें'
                  : 'Sign In to MoneyCircle'
                : mode === 'register'
                  ? lang === 'hi'
                    ? 'नया खाता बनाएं'
                    : 'Create Member Account'
                  : lang === 'hi'
                    ? 'पासवर्ड रीसेट करें'
                    : 'Reset Your Password'}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {lang === 'hi'
                ? 'Firebase प्रमाणीकरण द्वारा सुरक्षित'
                : 'Secured by Firebase Authentication'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Mode Tabs */}
        <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
              setInfoMsg('');
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {lang === 'hi' ? 'लॉगिन' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg('');
              setInfoMsg('');
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {lang === 'hi' ? 'रजिस्टर' : 'Register'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('forgot');
              setErrorMsg('');
              setInfoMsg('');
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              mode === 'forgot'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {lang === 'hi' ? 'रीसेट' : 'Forgot'}
          </button>
        </div>

        {/* Google Primary Auth */}
        {mode !== 'forgot' && (
          <div className="mt-5">
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{lang === 'hi' ? 'Google से जारी रखें' : 'Continue with Google'}</span>
            </button>

            <div className="relative my-4 flex items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              <span className="mx-3 text-xs text-slate-400">
                {lang === 'hi' ? 'या ईमेल द्वारा' : 'or with email'}
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'hi' ? 'पूरा नाम' : 'Full Name'}
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Aarav Sharma"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {lang === 'hi' ? 'ईमेल पता' : 'Email Address'}
            </label>
            <input
              type="email"
              required
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'hi' ? 'पासवर्ड' : 'Password'}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'hi' ? 'रेफरल कोड (वैकल्पिक)' : 'Referral Code (Optional)'}
              </label>
              <input
                type="text"
                maxLength={24}
                value={referralInput}
                onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                placeholder="MC-XXXX"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono uppercase text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            <span>
              {busy
                ? lang === 'hi'
                  ? 'प्रतीक्षा करें...'
                  : 'Please wait...'
                : mode === 'login'
                  ? lang === 'hi'
                    ? 'ईमेल से साइन इन करें'
                    : 'Sign In with Email'
                  : mode === 'register'
                    ? lang === 'hi'
                      ? 'पंजीकरण करें'
                      : 'Create Account'
                    : lang === 'hi'
                      ? 'रीसेट लिंक भेजें'
                      : 'Send Reset Link'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
