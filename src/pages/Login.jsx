import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../api/endpoints';
import { useAuth, useToast } from '../context/AppContext';
import { useConfig } from '../context/ConfigContext';
import { Contours, Illo } from '../components/illos';

const COOLDOWN = 30;

export default function Login() {
  const { login } = useAuth();
  const { brand } = useConfig();
  const { error: toastError } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState('signin');       // signin | signup
  const [step, setStep] = useState(1);              // 1 email → 2 code
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef(null);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => { if (step === 2) codeRef.current?.focus(); }, [step]);

  async function sendCode(e) {
    e?.preventDefault();
    setErr('');
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErr('Enter a valid email address.'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') await auth.signup({ email, name, companyName });
      else await auth.requestOtp(email);
      setStep(2);
      setCooldown(COOLDOWN);
    } catch (ex) {
      // Always a uniform response by design; only rate limiting surfaces here.
      setErr(ex.status === 429 ? 'Too many requests — wait a moment and try again.' : (ex.detail || ex.message));
    } finally { setBusy(false); }
  }

  async function verify(e) {
    e?.preventDefault();
    setErr('');
    if (code.trim().length < 4) { setErr('Enter the code from your email.'); return; }
    setBusy(true);
    try {
      const res = await auth.verifyOtp(email.trim(), code.trim()); // field name is `code`
      login(res);
      navigate('/start', { replace: true });
    } catch (ex) {
      if (ex.status === 403) setErr('Invalid or expired code. Check the code, or resend a new one.');
      else toastError(ex);
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-bg">
      <div className="auth-brand">
        <div>
          {/* The configured product name is always shown as text (QA issue
              6: with only a logo image, a changed Product Name never
              appeared on the login page). The mark, when set, sits above
              it — white variant, since this panel is dark. */}
          {(brand.logoMonoUrl || brand.logoUrl) && (
            <img
              src={brand.logoMonoUrl || brand.logoUrl}
              alt={brand.productName}
              className="brand-logo"
              style={{ height: 34, marginBottom: 10, display: 'block' }}
            />
          )}
          <div style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 600 }}>
            {brand.productName}
          </div>
          <h2 style={{ marginTop: 34 }}>Every founder deserves an investment banker in their corner.</h2>
          <div className="brand-points">
            <div className="brand-point">
              <span className="bp-illo"><Illo name="summit" size={44} /></span>
              <span><strong>Know where you stand</strong><span>AI research plus your inputs become a verified knowledge base and an honest readiness score.</span></span>
            </div>
            <div className="brand-point">
              <span className="bp-illo"><Illo name="scales" size={44} /></span>
              <span><strong>Strategy, defended</strong><span>Peer benchmarks, an ideal raise, and an indicative valuation range — always ranges, never guesses.</span></span>
            </div>
            <div className="brand-point">
              <span className="bp-illo"><Illo name="easel" size={44} /></span>
              <span><strong>Materials, never from a blank page</strong><span>Story, teaser, deck, model and IM drafted from your approved strategy — you refine, you don't create.</span></span>
            </div>
          </div>
        </div>
        <p style={{ position: 'relative', fontSize: 11.5, color: 'rgba(231,241,235,.55)', maxWidth: 380 }}>
          Guidance and drafts — not investment, legal or tax advice. Valuations are indicative ranges for discussion.
        </p>
        <Contours />
      </div>
      <div className="auth-side">
      <div className="auth-card">
        <div style={{ fontFamily: 'var(--display)', fontSize: 25, fontWeight: 600, marginBottom: 2, color: 'var(--green-950)' }}>
          {step === 2 ? (mode === 'signup' ? `Welcome to ${brand.productName}` : 'Welcome back') : 'Welcome'}
        </div>
        <p className="hint" style={{ marginBottom: 22 }}>Your AI investment banking workspace</p>

        {step === 1 ? (
          <form onSubmit={sendCode}>
            <div className="chips" style={{ marginBottom: 18 }}>
              <button type="button" className={`chip ${mode === 'signin' ? 'on' : ''}`} onClick={() => setMode('signin')}>Sign in</button>
              <button type="button" className={`chip ${mode === 'signup' ? 'on' : ''}`} onClick={() => setMode('signup')}>Create account</button>
            </div>
            {mode === 'signup' && (
              <>
                <label className="field"><span>Your name</span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" />
                </label>
                <label className="field"><span>Company name</span>
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme AI" />
                </label>
              </>
            )}
            <label className="field"><span>Work email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="founder@company.com" autoFocus />
            </label>
            {err && <p className="field-error">{err}</p>}
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
              {busy && <span className="spin" style={{ borderTopColor: '#fff' }} />} Send sign-in code
            </button>
            <p className="hint" style={{ marginTop: 14 }}>Passwordless — we email you a one-time code that expires in 5 minutes.</p>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p style={{ fontSize: 13.5 }}>We sent a code to <strong>{email}</strong>.</p>
            <label className="field"><span>One-time code</span>
              <input ref={codeRef} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                style={{ letterSpacing: 8, textAlign: 'center', fontSize: 20, fontWeight: 700 }} />
            </label>
            {err && <p className="field-error">{err}</p>}
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
              {busy && <span className="spin" style={{ borderTopColor: '#fff' }} />} Verify and sign in
            </button>
            <div className="spread" style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStep(1); setCode(''); setErr(''); }}>
                Use a different email
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={cooldown > 0} onClick={sendCode}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
      </div>
    </div>
  );
}
