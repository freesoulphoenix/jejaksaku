import { useState } from 'react';
import BrandMark from '../components/BrandMark.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function ForgotPasswordPage({ onShowLogin }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      await resetPassword(email);
      setMessage('Password reset email sent. Check your inbox for the Supabase reset link.');
    } catch (err) {
      setError(err.message || 'Unable to send reset email.');
    } finally {
      setSubmitting(false);
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
          <p className="section-kicker">Reset access</p>
          <h1>Forgot password</h1>
          <p>Send a reset link to your Dompet Daily account email.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-group">
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-success">{message}</p>}
          <button className="primary-button auth-submit" disabled={submitting} type="submit">
            {submitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p className="auth-switch">
          Remembered it?
          <button onClick={onShowLogin} type="button">Back to login</button>
        </p>
      </section>
    </main>
  );
}
