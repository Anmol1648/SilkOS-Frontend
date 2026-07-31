import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getTokens, setTokens, setUnauthorizedHandler } from '../api/client';

// ---------------- Auth ----------------
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getTokens());

  useEffect(() => {
    setUnauthorizedHandler(() => setSession(null));
  }, []);

  const login = useCallback((tokens) => { setTokens(tokens); setSession(tokens); }, []);
  const logout = useCallback(() => { setTokens(null); setSession(null); }, []);

  const value = useMemo(() => ({
    session, user: session?.user || null, isAuthed: !!session?.accessToken, login, logout,
  }), [session, login, logout]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

// ---------------- Toasts ----------------
const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, kind = 'ok') => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({
    toast: push,
    error: (m) => push(typeof m === 'string' ? m : (m?.detail || m?.message || 'Something went wrong'), 'error'),
  }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------------- Confirmation modal (Enhancement 2) ----------------
// Replaces the browser-native window.confirm/alert dialogs the app relied
// on for destructive actions (removing a founder/record, discarding an
// edit on regenerate, freezing a package, changing objectives). Those
// dialogs cannot be branded, cannot be styled, block the JS thread, and
// read as a system error rather than a product decision. useConfirm()
// returns a promise that resolves true/false, so a call site changes from
//   if (!window.confirm('Remove?')) return;
// to
//   if (!(await confirm({ message: 'Remove?' }))) return;
const ConfirmCtx = createContext(null);

const DEFAULTS = {
  title: 'Please confirm',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  tone: 'default', // 'default' | 'danger'
};

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // {opts} while open, null when closed
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    // Accept a bare string for convenience: confirm('Remove this?')
    const merged = typeof opts === 'string'
      ? { ...DEFAULTS, message: opts }
      : { ...DEFAULTS, ...opts };
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState(merged);
    });
  }, []);

  const settle = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    if (resolve) resolve(result);
  }, []);

  // Escape cancels, Enter confirms — parity with the native dialog.
  useEffect(() => {
    if (!state) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); settle(false); }
      else if (e.key === 'Enter') { e.preventDefault(); settle(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, settle]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) settle(false); }}
        >
          <div
            className="modal-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-body"
          >
            <h3 id="confirm-title" className="modal-title">{state.title}</h3>
            <div id="confirm-body" className="modal-body">
              {String(state.message).split('\n').map((line, i) => (
                <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0' }}>{line}</p>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => settle(false)} autoFocus>
                {state.cancelLabel}
              </button>
              <button
                className={`btn btn-sm ${state.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => settle(true)}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

// Returns confirm(opts) → Promise<boolean>. Safe fallback to window.confirm
// if a caller is ever rendered outside the provider (keeps behaviour, never
// throws).
export const useConfirm = () => {
  const ctx = useContext(ConfirmCtx);
  return ctx || ((opts) => Promise.resolve(
    window.confirm(typeof opts === 'string' ? opts : (opts?.message || 'Are you sure?'))));
};
