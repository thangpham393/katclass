"use client";

import { useCallback, useEffect, useState } from "react";
import { dbErrorMessage } from "./db";

/** Load dữ liệu async đơn giản: { data, loading, error, reload }. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    loader()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setError(dbErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, deps);

  useEffect(() => reload(), [reload]);

  return { data, loading, error, reload };
}
