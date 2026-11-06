import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api } from "./api";
import { onLive } from "./lib/live.js";
import { cacheGet, cachePut, getSnapshot, subscribe } from "./lib/offline.js";

// Bumps when a watched topic changes, the tab regains focus, or 30s pass (safety net if the live link drops).
function useLiveTick(topics) {
  const [n, setN] = useState(0);
  const key = topics.join(",");
  useEffect(() => {
    if (!key) return;
    const want = key.split(",");
    let t;
    const off = onLive((got) => {
      if (got.includes("*") || got.some((g) => want.includes(g))) {
        clearTimeout(t);
        t = setTimeout(() => setN((x) => x + 1), 250); // merge bursts into one refresh
      }
    });
    const bump = () => document.visibilityState === "visible" && setN((x) => x + 1);
    const poll = setInterval(bump, 30000);
    document.addEventListener("visibilitychange", bump);
    return () => { off(); clearTimeout(t); clearInterval(poll); document.removeEventListener("visibilitychange", bump); };
  }, [key]);
  return n;
}

export function useApi(path, topics = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const live = useLiveTick(topics);
  const shown = useRef(null); // the path the current data belongs to

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path)
      .then((data) => { if (alive) { shown.current = path; setState({ data, error: null, loading: false }); } })
      .catch((error) => {
        if (!alive) return;
        // A failed background refresh keeps what's on screen. A failed first load shows the error.
        setState((s) => (shown.current === path && s.data ? { ...s, loading: false } : { data: null, error, loading: false }));
      });
    return () => { alive = false; };
  }, [path, tick, live]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

// Same, but falls back to the copy saved on this device when offline.
export function useOfflineApi(path, key, topics = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true, stale: false });
  const [tick, setTick] = useState(0);
  const live = useLiveTick(topics);
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
        } else if (alive) setState((s) => (s.data ? { ...s, loading: false } : { data: null, error: e, loading: false, stale: false }));
      });
    return () => { alive = false; };
  }, [path, key, tick, live]);
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