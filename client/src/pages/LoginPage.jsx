import { useState } from 'react';
import BrandMark from '../components/BrandMark.jsx';
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
            <small>Receipts Don't Lie</small>
          </div>
        </div>

        <div className="auth-heading">
          <p className="section-kicker">Welcome back</p>
          <h1>Log in to Dompet Daily</h1>
          <p>Access your daily expense workspace.</p>
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
          <label className="field-group">
            Password
            <input
              autoComplete="current-password"
              enterKeyHint="done"
              id="login-password"
              minLength="6"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              required
              type="password"
              value={password}
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button className="primary-button auth-submit" disabled={submitting} type="submit">
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <button className="oauth-button" disabled={oauthSubmitting} onClick={handleGoogleSignIn} type="button">
          <span>G</span>
          {oauthSubmitting ? 'Opening Google...' : 'Continue with Google'}
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
