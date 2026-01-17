"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./CommandModal.module.css";

interface CommandModalProps {
  isOpen: boolean;
  prompt: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  autocomplete?: string | null;
  onTab?: () => void;
}

export default function CommandModal({
  isOpen,
  prompt,
  value,
  onChange,
  onSubmit,
  onCancel,
  autocomplete,
  onTab,
}: CommandModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [inputWidth, setInputWidth] = useState(0);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Measure input text width for autocomplete positioning
  useEffect(() => {
    if (measureRef.current) {
      setInputWidth(measureRef.current.offsetWidth);
    }
  }, [value]);

  // Handle keyboard input on the input element directly
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Tab" && onTab) {
      e.preventDefault();
      onTab();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.content}>
          <span className={styles.prompt}>{prompt}</span>
          <div className={styles.inputWrapper}>
            <span ref={measureRef} className={styles.measure}>
              {value}
            </span>
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label={prompt}
              autoFocus
            />
            {autocomplete && autocomplete !== value && (
              <span 
                className={styles.autocomplete}
                style={{ left: `${inputWidth}px` }}
              >
                {autocomplete.slice(value.length)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
