"use client";
import { useEffect, useRef } from "react";
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

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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

  const isPrefixMatch = !!autocomplete && autocomplete.toLowerCase().startsWith(value.toLowerCase());
  const showAutocomplete = isPrefixMatch && autocomplete !== value;
  const autocompleteSuffix = showAutocomplete ? autocomplete!.slice(value.length) : "";

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.content}>
          <span className={styles.prompt}>{prompt}</span>
          <div className={styles.inputWrapper}>
            {/* Display layer: shows typed text + autocomplete suggestion inline */}
            <div className={styles.displayLayer} aria-hidden="true">
              <span className={styles.typedText}>{value}</span>
              {showAutocomplete && (
                <span className={styles.autocomplete}>{autocompleteSuffix}</span>
              )}
            </div>
            {/* Input layer: transparent text, handles actual input */}
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
          </div>
        </div>
      </div>
    </div>
  );
}
