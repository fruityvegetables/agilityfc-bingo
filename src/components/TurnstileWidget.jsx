import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { getAppConfig, isDemoMode } from '../lib/config.js';

const TURNSTILE_ERROR_HINTS = {
  '110200': 'Domain not authorized — add this site under Turnstile → Hostname Management.',
  '110100': 'Invalid site key — check VITE_TURNSTILE_SITE_KEY matches your Turnstile widget.',
  '200500': 'Turnstile iframe blocked — allow challenges.cloudflare.com (ad blocker?).',
  '300': 'Challenge failed — try another browser or disable extensions.',
};

const HINTS = {
  auth: {
    idle:
      'Fill in username and password, then click Log In / Sign Up — captcha runs at submit time.',
    verifying: 'Complete the captcha check…',
    ready: 'Captcha verified — submitting…',
  },
  game: {
    idle: 'Complete captcha to enable the button.',
    verifying: 'Complete the captcha check…',
    ready: 'Captcha ready — submit now.',
  },
  gameSubmit: {
    idle: 'Fill in the form, then click the button — captcha runs at submit time.',
    verifying: 'Complete the captcha check…',
    ready: 'Captcha verified — submitting…',
  },
};

const TurnstileWidget = forwardRef(function TurnstileWidget(
  {
    onToken,
    onExpire,
    resetSignal = 0,
    token = '',
    status = 'idle',
    /** `auto` = captcha on load (host/join). `submit` = captcha when parent calls execute() (login/signup). */
    trigger = 'auto',
    context = 'game',
  },
  ref
) {
  const turnstileRef = useRef(null);
  const [widgetError, setWidgetError] = useState('');
  const { turnstileSiteKey, hasTurnstile } = getAppConfig();
  const runOnSubmit = trigger === 'submit';
  const hintSet = HINTS[runOnSubmit ? (context === 'auth' ? 'auth' : 'gameSubmit') : 'game'];

  useImperativeHandle(ref, () => ({
    execute: () => turnstileRef.current?.execute(),
    reset: () => {
      onToken('');
      setWidgetError('');
      turnstileRef.current?.reset();
    },
  }));

  useEffect(() => {
    if (resetSignal === 0) return;
    onToken('');
    setWidgetError('');
    turnstileRef.current?.reset();
  }, [resetSignal, onToken]);

  if (isDemoMode()) {
    return (
      <div className="turnstile-wrap turnstile-demo">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onToken('demo-turnstile-token')}
        >
          Demo captcha — click to pass
        </button>
      </div>
    );
  }

  if (!hasTurnstile) {
    return (
      <p className="form-message error">
        Turnstile site key missing. Set <code>VITE_TURNSTILE_SITE_KEY</code> in Cloudflare Pages
        environment variables and redeploy.
      </p>
    );
  }

  const clearToken = () => {
    onToken('');
    turnstileRef.current?.reset();
  };

  const hint =
    token && status === 'idle' && !runOnSubmit
      ? hintSet.ready
      : hintSet[status] || hintSet.idle;

  return (
    <div className="turnstile-wrap">
      <Turnstile
        ref={turnstileRef}
        siteKey={turnstileSiteKey}
        onSuccess={(value) => {
          setWidgetError('');
          onToken(value);
        }}
        onExpire={() => {
          clearToken();
          onExpire?.();
        }}
        onError={(code) => {
          clearToken();
          const hintMsg =
            TURNSTILE_ERROR_HINTS[code] || TURNSTILE_ERROR_HINTS[String(code).slice(0, 3)];
          setWidgetError(hintMsg || `Turnstile error ${code}. Check hostname and site key.`);
          onExpire?.();
        }}
        options={{
          theme: 'dark',
          size: 'normal',
          execution: runOnSubmit ? 'execute' : 'render',
          appearance: 'always',
          refreshExpired: 'auto',
        }}
      />
      {widgetError && <p className="form-message error turnstile-error">{widgetError}</p>}
      <p className={`hint turnstile-hint ${token ? 'turnstile-ready' : ''}`}>{hint}</p>
    </div>
  );
});

export default TurnstileWidget;
