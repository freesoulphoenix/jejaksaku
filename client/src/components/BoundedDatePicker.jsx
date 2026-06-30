import { useMemo } from 'react';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function toIsoDate({ year, month, day }) {
  return [
    String(year),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-');
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function clampDate(parts, minDate, maxDate) {
  const min = parseIsoDate(minDate);
  const max = parseIsoDate(maxDate);
  const fallback = max || min;

  if (!parts || !fallback) {
    return fallback;
  }

  let next = {
    year: parts.year,
    month: parts.month,
    day: Math.min(parts.day, daysInMonth(parts.year, parts.month))
  };

  const nextIso = toIsoDate(next);

  if (nextIso < minDate) {
    return min;
  }

  if (nextIso > maxDate) {
    return max;
  }

  return next;
}

export default function BoundedDatePicker({
  className = '',
  label = 'Date',
  maxDate,
  minDate,
  onChange,
  required = false,
  value
}) {
  const min = parseIsoDate(minDate);
  const max = parseIsoDate(maxDate);
  const parsedValue = parseIsoDate(value);
  const current = clampDate(parsedValue || max || min, minDate, maxDate);
  const minYear = min?.year || current?.year || new Date().getFullYear();
  const maxYear = max?.year || current?.year || minYear;

  const years = useMemo(() => (
    Array.from(
      { length: maxYear - minYear + 1 },
      (_, index) => minYear + index
    )
  ), [maxYear, minYear]);

  if (!min || !max || !current) {
    return null;
  }

  if (!required && !parsedValue) {
    return (
      <div className={`field-group bounded-date-picker ${className}`.trim()}>
        <span className="bounded-date-label">{label}</span>
        <button
          className="bounded-date-empty"
          onClick={() => onChange(toIsoDate(current))}
          type="button"
        >
          Set date
        </button>
      </div>
    );
  }

  const availableMonths = Array.from({ length: 12 }, (_, index) => index + 1)
    .filter((month) => {
      if (current.year === min.year && month < min.month) {
        return false;
      }

      if (current.year === max.year && month > max.month) {
        return false;
      }

      return true;
    });

  const availableDays = Array.from(
    { length: daysInMonth(current.year, current.month) },
    (_, index) => index + 1
  ).filter((day) => {
    const iso = toIsoDate({
      year: current.year,
      month: current.month,
      day
    });

    return iso >= minDate && iso <= maxDate;
  });

  function updateDate(partialDate) {
    const next = clampDate(
      {
        year: partialDate.year ?? current.year,
        month: partialDate.month ?? current.month,
        day: partialDate.day ?? current.day
      },
      minDate,
      maxDate
    );

    onChange(toIsoDate(next));
  }

  return (
    <div className={`field-group bounded-date-picker ${className}`.trim()}>
      <span className="bounded-date-label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>

      <div className="bounded-date-fields">
        <select
          aria-label={`${label} day`}
          onChange={(event) => updateDate({ day: Number(event.target.value) })}
          value={current.day}
        >
          {availableDays.map((day) => (
            <option key={day} value={day}>
              {String(day).padStart(2, '0')}
            </option>
          ))}
        </select>

        <select
          aria-label={`${label} month`}
          onChange={(event) => updateDate({ month: Number(event.target.value) })}
          value={current.month}
        >
          {availableMonths.map((month) => (
            <option key={month} value={month}>
              {MONTHS[month - 1]}
            </option>
          ))}
        </select>

        <select
          aria-label={`${label} year`}
          onChange={(event) => updateDate({ year: Number(event.target.value) })}
          value={current.year}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {!required && (
        <button
          className="bounded-date-clear"
          onClick={() => onChange('')}
          type="button"
        >
          Clear date
        </button>
      )}
    </div>
  );
}
