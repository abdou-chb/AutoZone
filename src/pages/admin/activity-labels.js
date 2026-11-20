export function activityLabel(t, entry) {
  const key = `adminShell.activity.actions.${entry.action.replaceAll(".", "_")}`;
  const text = t(key, { id: entry.target_id ?? "", ...(entry.details || {}) });

  return text === key ? entry.action : text;
}
