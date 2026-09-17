"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { userFacingError } from "./user-facing-error";

export type ScopedResourceStatus = "idle" | "loading" | "ready" | "empty" | "error";

type Snapshot<T> = {
  scopeKey: string | null;
  status: ScopedResourceStatus;
  data: T | null;
  error: string;
};

type Options<T> = {
  scopeKey: string | null | undefined;
  enabled?: boolean;
  loader: () => Promise<T>;
  errorFallback?: string;
  isEmpty?: (data: T) => boolean;
};

const defaultIsEmpty = <T,>(data: T) => Array.isArray(data) && data.length === 0;

export function useScopedResource<T>({
  scopeKey,
  enabled = true,
  loader,
  errorFallback,
  isEmpty = defaultIsEmpty,
}: Options<T>) {
  const normalizedScope = scopeKey || null;
  const epoch = useRef(0);
  const activeScope = useRef(normalizedScope);
  const activeEnabled = useRef(enabled);
  activeScope.current = normalizedScope;
  activeEnabled.current = enabled;
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({
    scopeKey: null,
    status: "idle",
    data: null,
    error: "",
  });

  const refresh = useCallback(async () => {
    if (!enabled || !normalizedScope) {
      setSnapshot({ scopeKey: normalizedScope, status: "idle", data: null, error: "" });
      return null;
    }
    if (activeScope.current !== normalizedScope || !activeEnabled.current) return null;
    const requestEpoch = ++epoch.current;

    setSnapshot((current) => ({
      scopeKey: normalizedScope,
      status: "loading",
      data: current.scopeKey === normalizedScope ? current.data : null,
      error: "",
    }));

    try {
      const data = await loader();
      if (requestEpoch !== epoch.current || activeScope.current !== normalizedScope || !activeEnabled.current) return null;
      setSnapshot({
        scopeKey: normalizedScope,
        status: isEmpty(data) ? "empty" : "ready",
        data,
        error: "",
      });
      return data;
    } catch (cause) {
      if (requestEpoch !== epoch.current || activeScope.current !== normalizedScope || !activeEnabled.current) return null;
      setSnapshot({
        scopeKey: normalizedScope,
        status: "error",
        data: null,
        error: userFacingError(cause, errorFallback),
      });
      return null;
    }
  }, [enabled, errorFallback, isEmpty, loader, normalizedScope]);

  useEffect(() => {
    void refresh();
    return () => {
      epoch.current += 1;
    };
  }, [refresh]);

  const visible = !enabled || !normalizedScope
    ? { scopeKey: normalizedScope, status: "idle" as const, data: null, error: "" }
    : snapshot.scopeKey === normalizedScope
    ? snapshot
    : {
        scopeKey: normalizedScope,
        status: enabled && normalizedScope ? "loading" as const : "idle" as const,
        data: null,
        error: "",
      };

  return { status: visible.status, data: visible.data, error: visible.error, refresh };
}
