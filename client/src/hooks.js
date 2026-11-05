import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api } from "./api";
import { cacheGet, cachePut, getSnapshot, subscribe } from "./lib/offline.js";

export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => { alive = false; };
  }, [path, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

// Same as useApi, but falls back to the copy saved on this device when offline.
export function useOfflineApi(path, key) {
  const [state, setState] = useState({ data: null, error: null, loading: true, stale: false });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    api(path)
      .then(async (data) => {
        await cachePut(key, data);
        alive && setState({ data, error: null, loading: false, stale: false });
      })
      .catch(async (e) => {
        if (e.offline) {
          const cached = await cacheGet(key);
          if (alive) setState(cached ? { data: cached, error: null, loading: false, stale: true } : { data: null, error: e, loading: false, stale: false });
        } else if (alive) setState({ data: null, error: e, loading: false, stale: false });
      });
    return () => { alive = false; };
  }, [path, key, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export const useSync = () => useSyncExternalStore(subscribe, getSnapshot);

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}