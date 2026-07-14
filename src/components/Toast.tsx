"use client";
import styles from "./Toast.module.css";

interface ToastProps {
  /** Message to display; when null the toast renders nothing. */
  message: string | null;
}

/**
 * Presentational transient toast. Renders a fixed, bottom-centered message when
 * one is present; renders nothing otherwise. Holds no timing/business logic.
 * @param message - The message to show, or null to render nothing.
 * @returns The toast element, or null when there is no message.
 */
export default function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  );
}
