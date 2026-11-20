import { useSyncExternalStore } from "react";

const STORAGE_KEY = "autozone:listing-pages";
const listeners = new Set();

function readStored() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY));

    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

let entries = readStored();

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    return;
  }
}

export function getListingEntry(scope) {
  return entries[scope];
}

export function updateListingEntry(scope, changes) {
  const current = entries[scope] || {};

  if (Object.entries(changes).every(([key, value]) => current[key] === value)) {
    return;
  }

  entries = { ...entries, [scope]: { ...current, ...changes } };
  persist();
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function useListingEntry(scope) {
  return useSyncExternalStore(subscribe, () => entries[scope]);
}

export function listingsLink(scope, home) {
  const search = entries[scope]?.search;

  return `${home}${search ? `?${search}` : ""}#listings`;
}
