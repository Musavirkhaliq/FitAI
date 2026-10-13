"use client";
import { useEffect } from "react";

/** Registers the service worker (offline shell + cached static assets). Failure is harmless. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    }
  }, []);
  return null;
}
