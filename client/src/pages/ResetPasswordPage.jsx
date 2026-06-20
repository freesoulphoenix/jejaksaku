import { useState } from 'react';
import BrandMark from '../components/BrandMark.jsx';
import PasswordGuidance from '../components/PasswordGuidance.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { isStrongPassword } from '../services/authService.js';

export default function ResetPasswordPage() {
  const { finishPasswordRecovery, saveNewPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      await saveNewPassword(password);
      setMessage('Password updated. You can continue to Jejak Dana.');
    } catch (err) {
      setError(err.message || 'Unable to update your password.');
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
            <strong>Jejak Dana</strong>
            <small>Access your daily expense workspace.</small>
          </div>
        </div>

        <div className="auth-heading">
          <p className="section-kicker">Reset password</p>
          <h1>Create a new password</h1>
          <p>Choose a stronger password for your Jejak Dana account.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <PasswordInput
            autoComplete="new-password"
            id="reset-password"
            label="New password"
            onChange={setPassword}
            placeholder="Your new password"
            value={password}
          />
          <PasswordGuidance password={password} />
          <PasswordInput
            autoComplete="new-password"
            id="reset-confirm-password"
            label="Confirm password"
            onChange={setConfirmPassword}
            placeholder="Repeat new password"
            value={confirmPassword}
          />
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-success">{message}</p>}
          <button className="primary-button auth-submit" disabled={submitting} type="submit">
            {submitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        {message && (
          <p className="auth-switch">
            Ready?
            <button onClick={finishPasswordRecovery} type="button">Continue</button>
          </p>
        )}
      </section>
    </main>
  );
}
