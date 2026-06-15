import { useState } from 'react';
import BrandMark from '../components/BrandMark.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function RegisterPage({ onShowLogin }) {
  const { loginWithGoogle, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      await register(email, password);
      setMessage('Account created. Check your email if Supabase requires confirmation, then log in.');
    } catch (err) {
      setError(err.message || 'Unable to create your account. If this email already has an account, please log in instead.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setMessage('');
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
          <p className="section-kicker">Start tracking</p>
          <h1>Create your account</h1>
          <p>Set up the authentication foundation for your Dompet Daily workspace.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-group">
            Email
            <input
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="next"
              id="register-email"
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
              autoComplete="new-password"
              enterKeyHint="next"
              id="register-password"
              minLength="6"
              name="new-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              required
              type="password"
              value={password}
            />
          </label>
          <label className="field-group">
            Confirm password
            <input
              autoComplete="new-password"
              enterKeyHint="done"
              id="register-confirm-password"
              minLength="6"
              name="confirm-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat password"
              required
              type="password"
              value={confirmPassword}
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-success">{message}</p>}
          <button className="primary-button auth-submit" disabled={submitting} type="submit">
            {submitting ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <button className="oauth-button" disabled={oauthSubmitting} onClick={handleGoogleSignIn} type="button">
          <span>G</span>
          {oauthSubmitting ? 'Opening Google...' : 'Continue with Google'}
        </button>

        <p className="auth-switch">
          Already have an account?
          <button onClick={onShowLogin} type="button">Log in</button>
        </p>
      </section>
    </main>
  );
}
