import { getLanguage, translate } from "../i18n/core";
import { DEFAULT_CATEGORY } from "./categories";

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest(path, { method = "GET", body, token, signal } = {}) {
  const headers = { "Accept-Language": getLanguage() };
  let payload = body;

  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, { method, headers, body: payload, signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    throw new ApiError(translate("common.errors.offline"), 0);
  }

  const data = await response.json().catch((error) => {
    if (error.name === "AbortError") {
      throw error;
    }

    return {};
  });

  if (!response.ok) {
    throw new ApiError(data.message || translate("common.errors.generic"), response.status, data);
  }

  return data;
}

export function imageUrl(path) {
  if (!path) {
    return "";
  }

  if (/^(https?:|data:|blob:)/.test(path)) {
    return path;
  }

  return `${API_URL}/${path.replace(/^\/+/, "")}`;
}

function toIssueList(issues) {
  if (Array.isArray(issues)) {
    return issues;
  }

  return String(issues || "")
    .split("\n")
    .map((issue) => issue.trim())
    .filter((issue) => issue && !/^(none|none known|no|-)\.?$/i.test(issue));
}

export function toListing(raw) {
  const images = [...(raw.images || [])]
    .sort((a, b) => b.is_main - a.is_main || a.sort_order - b.sort_order)
    .map((image) => imageUrl(image.image_path));

  if (!images.length && raw.mainImage) {
    images.push(imageUrl(raw.mainImage));
  }

  const specs = raw.specs && typeof raw.specs === "object" ? raw.specs : {};
  const columns = Object.fromEntries(
    ["mileage", "fuel", "transmission"]
      .filter((key) => raw[key] !== null && raw[key] !== undefined)
      .map((key) => [key, key === "mileage" ? Number(raw[key]) : raw[key]])
  );

  return {
    id: raw.id,
    category: raw.category || DEFAULT_CATEGORY,
    name: raw.name,
    year: Number(raw.year),
    price: Number(raw.price),
    mileage: columns.mileage ?? null,
    condition: raw.condition,
    fuel: columns.fuel ?? null,
    transmission: columns.transmission ?? null,
    attributes: { ...columns, ...specs },
    location: raw.location,
    description: raw.description || "",
    issues: toIssueList(raw.issues),
    status: raw.status,
    createdAt: raw.created_at,
    featured: Boolean(raw.featured),
    image: images[0] || "",
    images,
  };
}

const CACHE_TTL = 60000;
const CACHE_LIMIT = 80;
const cache = new Map();

export function readCache(path) {
  const entry = cache.get(path);

  return entry && "data" in entry && Date.now() - entry.time < CACHE_TTL ? entry.data : undefined;
}

export function loadResource(path, transform) {
  const entry = cache.get(path);

  if (entry && Date.now() - entry.time < CACHE_TTL) {
    return entry.promise;
  }

  const promise = apiRequest(path).then((raw) => {
    const data = transform ? transform(raw) : raw;
    const current = cache.get(path);

    if (current?.promise === promise) {
      current.data = data;
    }

    return data;
  });

  promise.catch(() => {
    if (cache.get(path)?.promise === promise) {
      cache.delete(path);
    }
  });

  cache.set(path, { promise, time: Date.now() });

  if (cache.size > CACHE_LIMIT) {
    cache.delete(cache.keys().next().value);
  }

  return promise;
}

export function forgetResource(path) {
  cache.delete(path);
}

export function clearResourceCache() {
  cache.clear();
}

export function toListingPage(raw) {
  return {
    listings: raw.cars.map(toListing),
    total: raw.total,
    page: raw.page,
    pageSize: raw.pageSize,
    pages: raw.pages,
  };
}

export function toShelves(raw) {
  return raw.results.map((result) => ({ total: result.total, listings: result.cars.map(toListing) }));
}

export async function fetchListing(id, signal) {
  const data = await apiRequest(`/api/cars/${id}`, { signal });

  return toListing(data.car);
}

// Car requests from the Tuning Zone: send one (pending until an admin decides), then follow it with its reference
// ("TZ-12") and the phone number it was sent with. Errors are ApiError; data.field names the field at fault.
export function submitCarRequest(payload) {
  return apiRequest("/api/tuning-requests", { method: "POST", body: payload });
}

export function trackCarRequest(reference, phone, { signal } = {}) {
  return apiRequest("/api/tuning-requests/status", { method: "POST", body: { reference, phone }, signal });
}

// Repair requests from the 3D Zone: send one (a FormData with a JSON "payload" field and up to 6 "images" files; saved
// as submitted until the garage reviews it), then follow it with its reference ("RP-12") and phone. On a validation
// error, data.field names the field at fault.
export function submitRepairRequest(formData) {
  return apiRequest("/api/repair-requests", { method: "POST", body: formData });
}

export function trackRepairRequest(reference, phone, { signal } = {}) {
  return apiRequest("/api/repair-requests/status", { method: "POST", body: { reference, phone }, signal });
}

// The customer's decision on the garage's quote: "accepted", "declined" or "clarification" (with a note).
export function decideRepairRequest(reference, phone, decision, note, { signal } = {}) {
  return apiRequest("/api/repair-requests/decision", { method: "POST", body: { reference, phone, decision, note }, signal });
}
