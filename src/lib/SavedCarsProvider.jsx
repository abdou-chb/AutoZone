import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api";
import { SavedCarsContext } from "./saved-context";

const STORAGE_KEY = "autozone:saved-cars";

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));

    return Array.isArray(value) ? value.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

export default function SavedCarsProvider({ children }) {
  const [savedIds, setSavedIds] = useState(readSaved);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedIds));
    } catch {
      return;
    }
  }, [savedIds]);

  useEffect(() => {
    const ids = readSaved().slice(0, 100);

    if (!ids.length) {
      return undefined;
    }

    const controller = new AbortController();

    apiRequest(`/api/cars/available?ids=${ids.join(",")}`, { signal: controller.signal })
      .then((data) => {
        const deleted = new Set(data.deleted || []);

        if (deleted.size) {
          setSavedIds((current) => current.filter((id) => !deleted.has(id)));
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  const isSaved = useCallback((id) => savedIds.includes(id), [savedIds]);

  const toggleSaved = useCallback((id) => {
    setSavedIds((current) =>
      current.includes(id) ? current.filter((savedId) => savedId !== id) : [id, ...current]
    );
  }, []);

  const removeSaved = useCallback((id) => {
    setSavedIds((current) => current.filter((savedId) => savedId !== id));
  }, []);

  const value = useMemo(
    () => ({ savedIds, isSaved, toggleSaved, removeSaved }),
    [savedIds, isSaved, toggleSaved, removeSaved]
  );

  return <SavedCarsContext.Provider value={value}>{children}</SavedCarsContext.Provider>;
}
