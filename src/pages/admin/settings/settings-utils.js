import { useEffect, useState } from "react";
import { loadLanguage, translate } from "../../../i18n/core";

export const LANGUAGE_CODES = ["en", "fr", "ar"];
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 10;

const PASSWORD_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function sameValue(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function isWebUrl(value) {
  return /^https?:\/\/[^\s.]+\.\S+$/.test(value);
}

export function isSiteLink(value) {
  return isWebUrl(value) || /^\/\S*$/.test(value);
}

export function isPhone(value) {
  return /^\+?[\d\s().-]{6,40}$/.test(value);
}

export function hasText(values) {
  return LANGUAGE_CODES.some((code) => values?.[code]?.trim());
}

export function textIn(key, language, vars = {}) {
  return translate(key, vars, language);
}

export function generatePassword(length = 14) {
  const values = crypto.getRandomValues(new Uint32Array(length));

  return Array.from(values, (value) => PASSWORD_LETTERS[value % PASSWORD_LETTERS.length]).join("");
}

export function toDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function dayKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function useAllLanguages() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;

    Promise.all(LANGUAGE_CODES.map((code) => loadLanguage(code)))
      .then(() => live && setReady(true))
      .catch(() => live && setReady(true));

    return () => {
      live = false;
    };
  }, []);

  return ready;
}

export function useUnsavedWarning(dirty) {
  useEffect(() => {
    if (!dirty) {
      return undefined;
    }

    function warn(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
