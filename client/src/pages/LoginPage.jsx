import { useState } from 'react';
import BrandMark from '../components/BrandMark.jsx';
import PasswordGuidance from '../components/PasswordGuidance.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function LoginPage({ onShowForgotPassword, onShowRegister }) {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Unable to log in. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setOauthSubmitting(true);

    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err.message || 'Unable to continue with Google.');
      setOauthSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <BrandMark />
          <div>
            <strong>Dompet Daily</strong>
            <small>Access your daily expense workspace.</small>
          </div>
        </div>

        <div className="auth-heading login-heading">
          <p className="section-kicker">Welcome back</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-group">
            Email
            <input
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="next"
              id="login-email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              spellCheck="false"
              type="email"
              value={email}
            />
          </label>
          <PasswordInput
            autoComplete="current-password"
            id="login-password"
            label="Password"
            minLength={1}
            name="password"
            onChange={setPassword}
            placeholder="Your password"
            value={password}
          />
          <PasswordGuidance password={password} />
          {error && <p className="auth-error">{error}</p>}
          <button className="primary-button auth-submit" disabled={submitting} type="submit">
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <button className="oauth-button" disabled={oauthSubmitting} onClick={handleGoogleSignIn} type="button">
          <span className="google-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h5.9c-.3 1.4-1 2.5-2.1 3.2v2.7h3.4c2-1.8 3.4-4.5 3.4-8Z" />
              <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.4-2.7c-.9.6-2.2 1-3.9 1-3 0-5.5-2-6.4-4.8H2.1v2.8C3.9 20.4 7.7 23 12 23Z" />
              <path fill="#FBBC05" d="M5.6 13.8c-.2-.6-.4-1.2-.4-1.8s.1-1.2.4-1.8V7.4H2.1C1.4 8.8 1 10.4 1 12s.4 3.2 1.1 4.6l3.5-2.8Z" />
              <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.5 2.1 15 1 12 1 7.7 1 3.9 3.6 2.1 7.4l3.5 2.8C6.5 7.4 9 5.4 12 5.4Z" />
            </svg>
          </span>
          {oauthSubmitting ? 'Opening Google...' : 'Sign in with Google'}
        </button>

        <p className="auth-switch compact-switch">
          Forgot password?
          <button onClick={onShowForgotPassword} type="button">Reset it</button>
        </p>

        <p className="auth-switch">
          New to Dompet Daily?
          <button onClick={onShowRegister} type="button">Create account</button>
        </p>
      </section>
    </main>
  );
}
