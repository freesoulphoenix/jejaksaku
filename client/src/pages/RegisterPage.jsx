import { useState } from 'react';
import BrandMark from '../components/BrandMark.jsx';
import PasswordGuidance from '../components/PasswordGuidance.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { isStrongPassword } from '../services/authService.js';

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

    if (!isStrongPassword(password)) {
      setError('PASSWORD MUST FOLLOW THE GUIDELINES');
      return;
    }

    if (password && confirmPassword && password !== confirmPassword) {
      setError('Passwords do not match');
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
            <small>Access your daily expense workspace.</small>
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
          <PasswordInput
            autoComplete="new-password"
            id="register-password"
            label="Password"
            name="new-password"
            onChange={setPassword}
            placeholder="Your password"
            value={password}
          />
          <PasswordGuidance password={password} />
          <PasswordInput
            autoComplete="new-password"
            id="register-confirm-password"
            label="Confirm password"
            name="confirm-password"
            onChange={setConfirmPassword}
            placeholder="Repeat password"
            value={confirmPassword}
          />
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-success">{message}</p>}
          <button className="primary-button auth-submit" disabled={submitting} type="submit">
            {submitting ? 'Creating account...' : 'Register'}
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
          {oauthSubmitting ? 'Opening Google...' : 'Sign up with Google'}
        </button>

        <p className="auth-switch">
          Already have an account?
          <button onClick={onShowLogin} type="button">Log in</button>
        </p>
      </section>
    </main>
  );
}
