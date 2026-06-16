import { validatePasswordStrength } from '../services/authService.js';

export default function PasswordGuidance({ password }) {
  const checks = validatePasswordStrength(password);
  const complete = Object.values(checks).every(Boolean);

  return (
    <p className={`password-guidance ${complete ? 'complete' : ''}`}>
      Use at least 8 characters with uppercase, lowercase, number, and special character.
    </p>
  );
}
