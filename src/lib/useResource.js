import { useCallback, useEffect, useState } from "react";
import { forgetResource, loadResource, readCache } from "./api";

export default function useResource(path, transform, group = "") {
  const [state, setState] = useState(() => ({ path, group, data: path ? readCache(path) : undefined, error: "" }));
  const [attempt, setAttempt] = useState(0);

  if (state.path !== path) {
    const cached = path ? readCache(path) : undefined;
    const keep = cached === undefined && state.group === group ? state.data : undefined;

    setState({ path, group, data: cached ?? keep, stale: keep !== undefined, error: "" });
  }

  useEffect(() => {
    if (!path) {
      return undefined;
    }

    let active = true;

    loadResource(path, transform).then(
      (data) => active && setState({ path, group, data, stale: false, error: "" }),
      (error) => active && setState((current) => ({ ...current, stale: false, error: error.message }))
    );

    return () => {
      active = false;
    };
  }, [path, group, transform, attempt]);

  const retry = useCallback(() => {
    forgetResource(path);
    setState((current) => ({ ...current, error: "" }));
    setAttempt((value) => value + 1);
  }, [path]);

  return {
    data: state.data,
    error: state.error,
    loading: Boolean(path) && !state.error && (state.data === undefined || Boolean(state.stale)),
    stale: Boolean(state.stale),
    retry,
  };
}
