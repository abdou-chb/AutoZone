export function pageItems(page, pages, siblings) {
  const slots = siblings * 2 + 5;
  const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

  if (pages <= slots) {
    return range(1, pages);
  }

  if (page <= siblings + 3) {
    return [...range(1, slots - 2), "gap-end", pages];
  }

  if (page >= pages - siblings - 2) {
    return [1, "gap-start", ...range(pages - slots + 3, pages)];
  }

  return [1, "gap-start", ...range(page - siblings, page + siblings), "gap-end", pages];
}
