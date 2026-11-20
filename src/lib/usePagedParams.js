import { useCallback, useEffect } from "react";
import { useNavigationType, useSearchParams } from "react-router-dom";
import { updateListingEntry, useListingEntry } from "./listing-store";

function readPage(raw) {
  return /^[1-9]\d{0,5}$/.test(raw ?? "") ? Number(raw) : null;
}

function signatureOf(params) {
  const copy = new URLSearchParams(params);

  copy.delete("page");
  copy.delete("lang");
  copy.sort();

  return copy.toString();
}

function withPage(signature, page) {
  if (page <= 1) {
    return signature;
  }

  return signature ? `${signature}&page=${page}` : `page=${page}`;
}

export default function usePagedParams(scope) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigationType = useNavigationType();
  const entry = useListingEntry(scope);

  const signature = signatureOf(searchParams);
  const rawPage = searchParams.get("page");
  const urlPage = readPage(rawPage);
  const restored =
    urlPage === null && navigationType !== "POP" && entry?.signature === signature && entry.page > 1
      ? entry.page
      : null;
  const page = urlPage ?? restored ?? 1;
  const search = withPage(signature, page);

  useEffect(() => {
    updateListingEntry(scope, { page, signature, search });
  }, [scope, page, signature, search]);

  useEffect(() => {
    if (restored === null && (rawPage === null || urlPage !== null)) {
      return;
    }

    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (restored) next.set("page", String(restored));
        else next.delete("page");

        return next;
      },
      { replace: true, preventScrollReset: true }
    );
  }, [restored, rawPage, urlPage, setSearchParams]);

  const hrefFor = useCallback(
    (target) => {
      const next = new URLSearchParams(searchParams);

      next.set("page", String(target));

      return `?${next}`;
    },
    [searchParams]
  );

  const setPage = useCallback(
    (target) => {
      const next = new URLSearchParams(searchParams);

      next.set("page", String(target));
      updateListingEntry(scope, { page: target, signature, search: withPage(signature, target) });
      setSearchParams(next, { preventScrollReset: true });
    },
    [scope, searchParams, signature, setSearchParams]
  );

  const updateParams = useCallback(
    (changes) => {
      const next = new URLSearchParams(searchParams);

      Object.entries(changes).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      next.delete("page");

      setSearchParams(next, { replace: true, preventScrollReset: true });
    },
    [searchParams, setSearchParams]
  );

  const clampPage = useCallback(
    (last) => {
      if (page <= last) {
        return;
      }

      const next = new URLSearchParams(searchParams);

      if (last > 1) next.set("page", String(last));
      else next.delete("page");

      setSearchParams(next, { replace: true, preventScrollReset: true });
    },
    [page, searchParams, setSearchParams]
  );

  return { searchParams, page, search, hrefFor, setPage, updateParams, clampPage };
}
