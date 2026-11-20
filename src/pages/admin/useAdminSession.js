import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, clearResourceCache } from "../../lib/api";

const TOKEN_KEY = "adminToken";

export function readToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    return;
  }
}

function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    return;
  }
}

export function isAuthError(error) {
  return error?.status === 401 || error?.status === 403;
}

export function isAbortError(error) {
  return error?.name === "AbortError";
}

export function useAdminSession() {
  const navigate = useNavigate();
  const controllerRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    return () => controller.abort();
  }, []);

  const request = useCallback(
    async (path, { method, body, signal } = {}) => {
      try {
        const data = await apiRequest(path, {
          method,
          body,
          token: readToken(),
          signal: signal || controllerRef.current?.signal,
        });

        if (method && method !== "GET") {
          clearResourceCache();
        }

        return data;
      } catch (error) {
        if (error?.status === 401) {
          clearToken();
          navigate("/admin/login", { replace: true, state: { expired: true } });
        }

        throw error;
      }
    },
    [navigate]
  );

  const logout = useCallback(() => {
    clearToken();
    navigate("/admin/login", { replace: true });
  }, [navigate]);

  return { request, logout };
}

export function useAdminData(request, path) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ path: null, attempt: -1, data: null, error: "" });

  useEffect(() => {
    if (!path) {
      return undefined;
    }

    const controller = new AbortController();

    request(path, { signal: controller.signal })
      .then((data) => setResult({ path, attempt, data, error: "" }))
      .catch((error) => {
        if (!isAbortError(error) && error?.status !== 401) {
          setResult({ path, attempt, data: null, error: error.message });
        }
      });

    return () => controller.abort();
  }, [request, path, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const current = result.path === path;

  return {
    data: current ? result.data : null,
    error: current ? result.error : "",
    loading: !current,
    refreshing: current && result.attempt !== attempt,
    reload,
  };
}
