import { API_BASE, AUTH_TOKEN } from "./constants";
import type { Job, JobEvent, Metrics } from "./types";

export async function listJobs(filters: { search?: string; phase?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.phase) params.set("phase", filters.phase);
  if (filters.status) params.set("status", filters.status);

  const data = await requestJson<{ jobs: Job[]; total: number }>(`/jobs?${params.toString()}`);
  return { jobs: data.jobs, total: data.total ?? data.jobs.length };
}

export async function getMetrics() {
  return requestJson<Metrics>("/metrics");
}

export async function createJob(payload: { pan: string }) {
  const response = await apiFetch("/jobs", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not start run.");
  return data as Job;
}

export async function getJobEvents(jobId: string) {
  const data = await requestJson<{ events: JobEvent[] }>(`/jobs/${jobId}/events`);
  return data.events;
}

export function openEventStream(jobId: string, afterSeq: number) {
  return new EventSource(`${API_BASE}/jobs/${jobId}/stream?afterSeq=${afterSeq}`);
}

export async function sendOtp(jobId: string, otp: string) {
  const response = await apiFetch(`/jobs/${jobId}/otp`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ otp }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "OTP was rejected.");
}

export async function continueAfterCaptcha(jobId: string) {
  const response = await apiFetch(`/jobs/${jobId}/continue`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not resume automation.");
}

export async function cancelJob(jobId: string) {
  const response = await apiFetch(`/jobs/${jobId}/cancel`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not cancel run.");
}

export async function deleteJob(jobId: string) {
  const response = await apiFetch(`/jobs/${jobId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not delete run.");
}

function authHeaders(headers: HeadersInit = {}) {
  if (!AUTH_TOKEN) return headers;
  return { ...headers, Authorization: `Bearer ${AUTH_TOKEN}` };
}

async function requestJson<T>(path: string) {
  const response = await apiFetch(path);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `API request failed with ${response.status}`);
  }
  return data as T;
}

async function apiFetch(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    return await fetchWithBase(API_BASE, path, init, controller.signal);
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("Backend took too long to respond. Please refresh or retry.");
    }
    throw new Error("Could not reach backend API. Please refresh or retry.");
  } finally {
    window.clearTimeout(timeout);
  }
}

function fetchWithBase(base: string, path: string, init: RequestInit | undefined, signal: AbortSignal) {
  return fetch(`${base}${path}`, {
    ...init,
    signal,
  });
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
