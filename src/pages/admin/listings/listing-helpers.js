const LIST_SEARCH_KEY = "admin:listings:search";

export const LISTING_STATUSES = ["pending", "approved", "sold", "rejected"];

export function rememberListSearch(search) {
  try {
    sessionStorage.setItem(LIST_SEARCH_KEY, search);
  } catch {
    return;
  }
}

export function listHref() {
  try {
    const search = sessionStorage.getItem(LIST_SEARCH_KEY);

    return search && search.startsWith("?") ? `/admin/listings${search}` : "/admin/listings";
  } catch {
    return "/admin/listings";
  }
}

export function sellerName(raw) {
  return [raw.seller_first_name, raw.seller_last_name].filter(Boolean).join(" ");
}

export function isQuietError(error) {
  return error?.name === "AbortError" || error?.status === 401;
}
