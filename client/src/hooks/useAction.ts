import { useState } from 'react';
import { errorMessage } from '../api/client';

export interface Feedback {
  kind: 'success' | 'error';
  text: string;
}

/**
 * For buttons that change something (cancel, confirm, …). Tracks which action
 * is in flight so its button can be disabled, and the message to show after.
 * Success is shown only after the server says OK; failures show the server's reason.
 */
export function useAction() {
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function run(key: string, action: () => Promise<unknown>, successText: string) {
    setPending(key);
    setFeedback(null);
    try {
      await action();
      setFeedback({ kind: 'success', text: successText });
      return true;
    } catch (err) {
      setFeedback({ kind: 'error', text: errorMessage(err) });
      return false;
    } finally {
      setPending(null);
    }
  }

  return { pending, feedback, run, clearFeedback: () => setFeedback(null) };
}
