'use client';

import { useState, useEffect, useRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

type IMEInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function IMEInput({ value, onValueChange, ...props }: IMEInputProps) {
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
        onValueChange((e.target as HTMLInputElement).value);
      }}
    />
  );
}

type IMETextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function IMETextarea({ value, onValueChange, ...props }: IMETextareaProps) {
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
        onValueChange((e.target as HTMLTextAreaElement).value);
      }}
    />
  );
}
