'use client';

import { useEffect, useRef, useState, InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'type'> & {
  value: number;
  onValueChange: (n: number) => void;
};

// Sanitize typed input: allow digits, single leading minus, single decimal point.
// Strip leading zeros while preserving "0", "0.X", "-0", "-0.X".
function sanitize(raw: string): string {
  let s = raw.replace(/[^\d.\-]/g, '');
  const leadingMinus = s.startsWith('-');
  s = s.replace(/-/g, '');
  if (leadingMinus) s = '-' + s;
  const dot = s.indexOf('.');
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  s = s.replace(/^(-?)0+(?=\d)/, '$1');
  return s;
}

// Controlled numeric input using type="text" + inputMode="decimal".
// Using type="number" triggers React's stale-DOM bug: when the user's typed
// string (e.g. "05") parses to the same number already in state, React skips
// the DOM rewrite and leaves the leading zero visible.
export function NumericInput({ value, onValueChange, onFocus, onBlur, onChange, ...rest }: Props) {
  const initial = value === 0 || Number.isNaN(value) ? '' : String(value);
  const [display, setDisplay] = useState<string>(initial);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDisplay(value === 0 || Number.isNaN(value) ? '' : String(value));
    }
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={display}
      onFocus={(e) => {
        focusedRef.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        const n = parseFloat(display);
        if (Number.isNaN(n)) {
          setDisplay('');
          onValueChange(0);
        } else {
          setDisplay(n === 0 ? '' : String(n));
          onValueChange(n);
        }
        onBlur?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        const s = sanitize(raw);
        // When sanitize normalizes the input (e.g. "01" -> "1") but the
        // resulting string equals the current display state, React bails out
        // of the re-render and the DOM keeps showing the un-sanitized text.
        // Force-sync the DOM value so the leading zero actually disappears.
        if (raw !== s) e.target.value = s;
        setDisplay(s);
        const n = parseFloat(s);
        onValueChange(Number.isNaN(n) ? 0 : n);
        onChange?.(e);
      }}
    />
  );
}
