import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const KEY = "sutra_user"; // name, role and campus only. The real session is the httpOnly cookie.
const readCached = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const writeCached = (u) => { try { u ? localStorage.setItem(KEY, JSON.stringify(u)) : localStorage.removeItem(KEY); } catch { /* ignore */ } };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api("/auth/me")
      .then((d) => { setUser(d.user); writeCached(d.user); })
      .catch((e) => {
        if (e.offline) setUser(readCached()); // no signal: keep the teacher in
        else { setUser(null); writeCached(null); }
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api("/auth/login", { method: "POST", body: { email, password } });
    setUser(d.user); writeCached(d.user);
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null); writeCached(null);
  }, []);

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}