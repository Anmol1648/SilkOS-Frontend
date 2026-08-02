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
    <div className="auth-bg-light">
      <div className="auth-brand-light">
        <div>
          <div className="brand-logo-wrap">
            {brand.logoUrl && (
              <img
                src={brand.logoUrl}
                alt={brand.productName}
              />
            )}
            <span>{brand.productName}</span>
          </div>
          <h2>Every founder deserves<br />an investment banker<br />in their corner.</h2>
          <p className="subtitle" style={{ fontSize: 14 }}>Guidance and drafts — not investment, legal<br />or tax advice. Valuations are indicative<br />ranges for discussion.</p>
        </div>

        <div className="brand-points-row">
          <div className="brand-point">
            <span className="bp-illo"><Illo name="summit" size={18} /></span>
            <div className="brand-point-text">
              <strong>Know where you stand</strong>
              <span>Verified readiness score</span>
            </div>
          </div>
          <div className="brand-point">
            <span className="bp-illo"><Illo name="scales" size={18} /></span>
            <div className="brand-point-text">
              <strong>Strategy, defended</strong>
              <span>Data-backed benchmarks</span>
            </div>
          </div>
          <div className="brand-point">
            <span className="bp-illo"><Illo name="easel" size={18} /></span>
            <div className="brand-point-text">
              <strong>AI-drafted Materials</strong>
              <span>You refine, not create</span>
            </div>
          </div>
        </div>
      </div>
      <div className="auth-side-light">
        <div className="auth-card-light">
          <div className="auth-title">
            Welcome
          </div>
          <p className="auth-subtitle">Sign in to continue to {brand.productName}</p>

          {step === 1 ? (
            <form onSubmit={sendCode}>
              <div className="auth-tabs">
                <button type="button" className={`auth-tab ${mode === 'signin' ? 'active' : ''}`} onClick={() => setMode('signin')}>Sign in</button>
                <button type="button" className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')}>Create account</button>
              </div>

              {mode === 'signup' && (
                <>
                  <label className="field-light"><span>Your name</span>
                    <input className="input-light" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" />
                  </label>
                  <label className="field-light"><span>Company name</span>
                    <input className="input-light" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme AI" />
                  </label>
                </>
              )}
              <label className="field-light"><span>Email address</span>
                <div className="input-light-group">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" ry="2"></rect><polyline points="3 7 12 13 21 7"></polyline></svg>
                  <input className="input-light" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoFocus />
                </div>
              </label>

              {err && <p className="field-error" style={{ marginBottom: 14 }}>{err}</p>}

              <button className="btn-dark" disabled={busy} style={{ marginTop: 10 }}>
                {busy && <span className="spin" style={{ borderTopColor: '#fff', width: 14, height: 14, borderWidth: 2 }} />}
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>

              <p className="hint" style={{ marginTop: 24, textAlign: 'center' }}>
                Passwordless — we email you a one-time code that expires in 5 minutes.
              </p>
            </form>
          ) : (
            <form onSubmit={verify}>
              <p style={{ fontSize: 14, marginBottom: 20 }}>We sent a code to <strong>{email}</strong>.</p>
              <label className="field-light">
                <span style={{ marginBottom: 12, display: 'block' }}>One-time code</span>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <input
                      key={index}
                      id={`otp-input-${index}`}
                      type="text"
                      inputMode="numeric"
                      className="input-light"
                      maxLength={2}
                      value={code[index] || ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (!val && e.target.value) return;
                        let char = val;
                        if (val.length > 1) {
                          char = val.replace(code[index] || '', '') || val[1];
                        }
                        char = char.slice(-1);
                        let newCode = code.split('');
                        newCode[index] = char;
                        setCode(newCode.join(''));
                        if (char && index < 5) document.getElementById(`otp-input-${index + 1}`)?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace') {
                          e.preventDefault();
                          if (code[index]) {
                            let newCode = code.split('');
                            newCode[index] = '';
                            setCode(newCode.join(''));
                          } else if (index > 0) {
                            let newCode = code.split('');
                            newCode[index - 1] = '';
                            setCode(newCode.join(''));
                            document.getElementById(`otp-input-${index - 1}`)?.focus();
                          }
                        } else if (e.key === 'ArrowLeft') {
                          e.preventDefault();
                          if (index > 0) document.getElementById(`otp-input-${index - 1}`)?.focus();
                        } else if (e.key === 'ArrowRight') {
                          e.preventDefault();
                          if (index < 5) document.getElementById(`otp-input-${index + 1}`)?.focus();
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, 6);
                        if (pasted) {
                          setCode(pasted);
                          document.getElementById(`otp-input-${Math.min(pasted.length, 5)}`)?.focus();
                        }
                      }}
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      ref={index === 0 ? codeRef : null}
                      style={{ width: '54px', height: '60px', padding: 0, textAlign: 'center', fontSize: '24px', fontWeight: '600', borderRadius: '12px' }}
                    />
                  ))}
                </div>
              </label>
              {err && <p className="field-error" style={{ marginBottom: 14 }}>{err}</p>}
              <button className="btn-dark" disabled={busy}>
                {busy && <span className="spin" style={{ borderTopColor: '#fff', width: 14, height: 14, borderWidth: 2 }} />} Verify and sign in
              </button>
              <div className="spread" style={{ marginTop: 20 }}>
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
