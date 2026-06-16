import { useState } from 'react';

export default function PasswordInput({
  autoComplete,
  id,
  label,
  minLength = 8,
  name,
  onChange,
  placeholder,
  value
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="field-group">
      {label}
      <span className="password-field">
        <input
          autoComplete={autoComplete}
          enterKeyHint="done"
          id={id}
          minLength={minLength}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {visible ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.7 5.1c.4-.1.9-.1 1.3-.1 5 0 8.5 4.2 9.7 6-.5.8-1.7 2.3-3.5 3.6" />
                <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" />
                <path d="M6.6 6.6C4.5 7.9 3.1 9.8 2.3 11c1.2 1.8 4.7 6 9.7 6 1.5 0 2.9-.4 4.1-1" />
              </>
            ) : (
              <>
                <path d="M2.3 12s3.7-7 9.7-7 9.7 7 9.7 7-3.7 7-9.7 7-9.7-7-9.7-7Z" />
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              </>
            )}
          </svg>
        </button>
      </span>
    </label>
  );
}
