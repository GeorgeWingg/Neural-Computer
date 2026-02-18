const SESSION_KEY = 'neural-os-session-id';
const LEGACY_SESSION_KEYS = ['neural-computer-session-id', 'gemini-os-session-id'];

function randomSessionId(): string {
  return `sess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function getSessionId(): string {
  const existing =
    localStorage.getItem(SESSION_KEY) || LEGACY_SESSION_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!localStorage.getItem(SESSION_KEY) && existing) {
    localStorage.setItem(SESSION_KEY, existing);
    LEGACY_SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
  }
  if (existing) return existing;
  const created = randomSessionId();
  localStorage.setItem(SESSION_KEY, created);
  return created;
}
