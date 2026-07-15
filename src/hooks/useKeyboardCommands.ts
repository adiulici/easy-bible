"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Command, CommandMode, KeyboardCommandsAPI } from "@/types/commands";

/**
 * Hook for managing keyboard commands with support for:
 * - Single key commands (immediate execution)
 * - Modal commands (set mode and collect input)
 * - Input buffer tracking
 * - Automatic ignoring when typing in input fields
 */
export function useKeyboardCommands(): KeyboardCommandsAPI {
  const [activeMode, setActiveMode] = useState<CommandMode>(null);
  const [inputBuffer, setInputBuffer] = useState<string>("");
  const commandsRef = useRef<Map<string, Command>>(new Map());
  const activeModeRef = useRef<CommandMode>(null);
  // Tracks a single pending key press while we wait to see if it completes a
  // two-key chord (e.g. "gg"), so a lone "g" doesn't have to trigger anything.
  const chordBufferRef = useRef<{ key: string; timestamp: number } | null>(null);
  const CHORD_TIMEOUT_MS = 600;

  // Keep ref in sync with state
  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  /**
   * Check if the user is currently typing in an input field
   */
  const isTypingInInput = useCallback((): boolean => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const tagName = activeElement.tagName.toLowerCase();
    const isInput =
      tagName === "input" ||
      tagName === "textarea" ||
      (activeElement instanceof HTMLElement && activeElement.isContentEditable);

    return isInput;
  }, []);

  /**
   * Register a new command
   */
  const registerCommand = useCallback((command: Command) => {
    commandsRef.current.set(command.key, command);
  }, []);

  /**
   * Cancel the current command/mode
   */
  const cancelCommand = useCallback(() => {
    setActiveMode(null);
    setInputBuffer("");
  }, []);

  /**
   * Handle keyboard events
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore commands when typing in input fields
      if (isTypingInInput()) {
        return;
      }

      const currentMode = activeModeRef.current;

      // Escape key cancels any active command
      if (event.key === "Escape") {
        if (currentMode !== null) {
          event.preventDefault();
          setActiveMode(null);
          setInputBuffer("");
        }
        return;
      }

      // If we're in a modal mode, collect input
      if (currentMode !== null) {
        // Allow backspace to delete from buffer
        if (event.key === "Backspace") {
          event.preventDefault();
          setInputBuffer((prev) => prev.slice(0, -1));
          return;
        }

        // Allow Enter to submit (handled by the component using the hook)
        if (event.key === "Enter") {
          // Don't prevent default - let the component handle it
          return;
        }

        // For other keys, add to input buffer
        // Only add printable characters (not special keys)
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          setInputBuffer((prev) => prev + event.key);
        }
        return;
      }

      // If not in a mode, check for registered commands
      const key = event.key;

      // Check if this key completes a pending chord (e.g. "g" then "g")
      if (chordBufferRef.current && Date.now() - chordBufferRef.current.timestamp < CHORD_TIMEOUT_MS) {
        const chordKey = chordBufferRef.current.key + key;
        const chordCommand = commandsRef.current.get(chordKey);
        chordBufferRef.current = null;
        if (chordCommand) {
          event.preventDefault();
          chordCommand.handler?.();
          return;
        }
      }

      // Check if this key starts a registered chord; if so, wait for the next key
      const startsChord = Array.from(commandsRef.current.keys()).some(
        (registeredKey) => registeredKey.length === 2 && registeredKey[0] === key
      );
      if (startsChord) {
        chordBufferRef.current = { key, timestamp: Date.now() };
        event.preventDefault();
        return;
      }

      const command = commandsRef.current.get(key);
      if (command) {
        event.preventDefault();

        if (command.type === "single") {
          // Execute single command immediately
          command.handler?.();
        } else if (command.type === "modal") {
          // Activate modal mode
          if (command.mode) {
            setActiveMode(command.mode);
            setInputBuffer("");
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTypingInInput]);

  return {
    activeMode,
    inputBuffer,
    registerCommand,
    cancelCommand,
    setInputBuffer,
    setActiveMode,
  };
}
