/**
 * Type definitions for the keyboard command system
 */

export type CommandMode = null | "goto-chapter" | "goto-book" | "visibility";

export type CommandType = "single" | "modal";

export interface Command {
  /** The key that triggers this command (e.g., "g", "v", "j") */
  key: string;
  /** Type of command: "single" executes immediately, "modal" opens a modal and collects input */
  type: CommandType;
  /** The mode this command activates (only for modal commands) */
  mode?: CommandMode;
  /** Handler function called when command is triggered (for single commands) */
  handler?: () => void;
}

export interface KeyboardCommandsState {
  /** Current active command mode (null when no modal is open) */
  activeMode: CommandMode;
  /** Current input buffer for modal commands */
  inputBuffer: string;
}

export interface KeyboardCommandsAPI {
  /** Current active command mode */
  activeMode: CommandMode;
  /** Current input buffer */
  inputBuffer: string;
  /** Register a new command */
  registerCommand: (command: Command) => void;
  /** Cancel the current command/mode */
  cancelCommand: () => void;
  /** Set the input buffer (for external updates) */
  setInputBuffer: (value: string) => void;
}
