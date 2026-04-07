import { useState, useEffect, useRef } from 'react';

export function IMEInput({ value, onValueChange, ...props }) {
  const [local, setLocal] = useState(value);
  const composing = useRef(false);

  useEffect(() => {
    if (!composing.current) setLocal(value);
  }, [value]);

  return (
    <input
      {...props}
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        if (!composing.current) onValueChange(e.target.value);
      }}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={(e) => {
        composing.current = false;
        onValueChange(e.target.value);
      }}
    />
  );
}

export function IMETextarea({ value, onValueChange, ...props }) {
  const [local, setLocal] = useState(value);
  const composing = useRef(false);

  useEffect(() => {
    if (!composing.current) setLocal(value);
  }, [value]);

  return (
    <textarea
      {...props}
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        if (!composing.current) onValueChange(e.target.value);
      }}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={(e) => {
        composing.current = false;
        onValueChange(e.target.value);
      }}
    />
  );
}
