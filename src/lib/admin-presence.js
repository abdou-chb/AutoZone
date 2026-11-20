import { useEffect, useState } from "react";
import { apiRequest } from "./api";

const TOKEN_KEY = "adminToken";
let check = null;

export function adminToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function forgetToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    return;
  }
}

function currentAdmin(token) {
  if (!check || check.token !== token) {
    check = {
      token,
      promise: apiRequest("/api/admin/me", { token })
        .then((data) => data.admin)
        .catch((error) => {
          if (error.status === 401) {
            forgetToken();
          }

          return null;
        }),
    };
  }

  return check.promise;
}

export function adminRequest(path, options = {}) {
  return apiRequest(path, { ...options, token: adminToken() });
}

export function useAdminPresence() {
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    const token = adminToken();

    if (!token) {
      return undefined;
    }

    let active = true;

    currentAdmin(token).then((value) => {
      if (active) {
        setAdmin(value);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return admin;
}
