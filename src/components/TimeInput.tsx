"use client";

import { useRef } from "react";

type TimeInputProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
};

export function TimeInput({ id, name, value, onChange }: TimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;

    try {
      input?.showPicker?.();
    } catch {
      input?.focus();
    }
  }

  return (
    <input
      id={id}
      name={name}
      ref={inputRef}
      type="time"
      value={value}
      className="time-input"
      onClick={openPicker}
      onFocus={openPicker}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
