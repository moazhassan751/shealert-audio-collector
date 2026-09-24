const API = import.meta.env.VITE_API_URL || "";

export async function getHealth() {
  try {
    const response = await fetch(`${API}/api/health`);
    if (!response.ok) return { status: "offline", storage: "offline", google_drive_connected: false };
    return response.json();
  } catch {
    return { status: "offline", storage: "offline", google_drive_connected: false };
  }
}

export async function getPhrases() {
  const response = await fetch(`${API}/api/phrases`);
  if (!response.ok) throw new Error("Unable to load phrases.");
  return response.json();
}

export async function getSessionContent() {
  const response = await fetch(`${API}/api/session-content`);
  if (!response.ok) throw new Error("Unable to load the session script.");
  return response.json();
}

export async function getNextParticipantId(gender) {
  const response = await fetch(`${API}/api/next-participant-id?gender=${encodeURIComponent(gender)}`);
  if (!response.ok) throw new Error("Unable to fetch next participant ID.");
  return response.json();
}

export async function uploadRecording(item, onProgress) {
  const body = new FormData();
  Object.entries(item.metadata).forEach(([key, value]) => body.append(key, String(value)));
  body.append("audio", item.blob, item.filename || "recording.webm");
  const response = await fetch(`${API}/api/recordings`, { method: "POST", body });
  if (!response.ok) {
    let detail = "Upload failed. Your recording has not been lost.";
    try { detail = (await response.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  onProgress?.(100);
  return response.json();
}

export async function adminLogin(password) {
  const response = await fetch(`${API}/api/admin/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  if (!response.ok) throw new Error("Invalid administrator password.");
  return response.json();
}

export async function adminFetch(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options, headers: { ...(options.headers || {}), "X-Admin-Token": token }
  });
  if (!response.ok) throw new Error("Administrator request failed.");
  return response;
}
