import { appointmentKey, fetchAppointments } from "./terminland.js";
import { config } from "./config.js";
import { getState, getSubscribers, saveState } from "./storage.js";
import { notifySubscribers } from "./notifier.js";

let running = false;

export async function runCheck({ forceNotify = false } = {}) {
  if (running) return getState();
  running = true;

  try {
    const result = await fetchAppointments();
    const state = await getState();
    const key = appointmentKey(result);
    const shouldNotify = forceNotify || config.notifyEveryCheck || key !== state.lastNotifiedKey;

    const nextState = {
      ...state,
      lastCheckAt: result.checkedAt,
      lastResult: result,
      error: null
    };

    if (shouldNotify) {
      const subscribers = await getSubscribers();
      if (subscribers.length > 0) {
        await notifySubscribers(subscribers, result);
      }
      nextState.lastNotifiedKey = key;
      nextState.lastNotifiedAt = new Date().toISOString();
    }

    await saveState(nextState);
    return nextState;
  } catch (error) {
    const state = await getState();
    const nextState = {
      ...state,
      lastCheckAt: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack
      }
    };
    await saveState(nextState);
    return nextState;
  } finally {
    running = false;
  }
}

export function startChecker(intervalMs) {
  runCheck().catch((error) => console.error(error));
  return setInterval(() => {
    runCheck().catch((error) => console.error(error));
  }, intervalMs);
}
