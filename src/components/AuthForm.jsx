import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import TurnstileWidget from './TurnstileWidget.jsx';
import { isValidUsername } from '../utils/username.js';

const MODES = {
  login: { title: 'Enter the Wilderness', submit: 'Log In' },
  signup: { title: 'Register Scout', submit: 'Sign Up' },
};

export default function AuthForm() {
  const { signUp, logIn } = useAuth();
  const turnstileRef = useRef(null);
  const pendingSubmit = useRef(false);

  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [captchaStatus, setCaptchaStatus] = useState('idle');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const resetCaptcha = useCallback(() => {
    setTurnstileToken('');
    setCaptchaStatus('idle');
    pendingSubmit.current = false;
    setTurnstileReset((n) => n + 1);
  }, []);

  const switchMode = (next) => {
    setMode(next);
    setPassword('');
    setMessage({ type: '', text: '' });
    resetCaptcha();
  };

  const runAuth = async (token) => {
    setBusy(true);
    setCaptchaStatus('ready');
    const result =
      mode === 'login'
        ? await logIn(username, password, token)
        : await signUp(username, password, token);
    setBusy(false);
    setCaptchaStatus('idle');

    if (!result.ok) {
      setMessage({ type: 'error', text: result.error || 'Request failed.' });
      resetCaptcha();
      return;
    }
  };

  const handleToken = useCallback(
    async (token) => {
      setTurnstileToken(token);
      if (!pendingSubmit.current || !token) return;
      pendingSubmit.current = false;
      await runAuth(token);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runAuth closes over current mode/credentials
    [mode, username, password]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!isValidUsername(username)) {
      setMessage({
        type: 'error',
        text: 'Username must be 3–20 characters (letters, numbers, underscores).',
      });
      return;
    }

    if (!password) {
      setMessage({ type: 'error', text: 'Password is required.' });
      return;
    }

    if (busy || captchaStatus === 'verifying') return;

    pendingSubmit.current = true;
    setCaptchaStatus('verifying');
    setTurnstileToken('');
    turnstileRef.current?.reset();
    turnstileRef.current?.execute();
  };

  const handleCaptchaExpire = () => {
    pendingSubmit.current = false;
    setCaptchaStatus('idle');
    if (busy) return;
    setMessage({ type: 'error', text: 'Captcha expired. Click submit again.' });
  };

  const { title, submit } = MODES[mode];
  const canSubmit = isValidUsername(username) && Boolean(password) && !busy;

  return (
    <div className="auth-shell">
      <div className="auth-panel stone-panel">
        <div className="wildy-badge">Lvl 56</div>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-subtitle">Username + password · protected by Turnstile</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="wildy_scout"
              autoComplete="username"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Any text works"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          <TurnstileWidget
            ref={turnstileRef}
            trigger="submit"
            context="auth"
            token={turnstileToken}
            status={captchaStatus}
            resetSignal={turnstileReset}
            onToken={handleToken}
            onExpire={handleCaptchaExpire}
          />

          {message.text && <p className={`form-message ${message.type}`}>{message.text}</p>}

          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {busy ? 'Working…' : captchaStatus === 'verifying' ? 'Verify captcha…' : submit}
          </button>
        </form>

        <div className="auth-links">
          {mode === 'login' ? (
            <button type="button" className="link-btn" onClick={() => switchMode('signup')}>
              Create account
            </button>
          ) : (
            <button type="button" className="link-btn" onClick={() => switchMode('login')}>
              Already registered? Log in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
