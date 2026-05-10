"use client";

import { useState, useCallback } from "react";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
}

let toastListeners: Array<(toasts: Toast[]) => void> = [];
let toastQueue: Toast[] = [];

function notify() {
  toastListeners.forEach((fn) => fn([...toastQueue]));
}

export function toast(opts: Omit<Toast, "id">) {
  const id = Math.random().toString(36).slice(2);
  toastQueue.push({ id, ...opts });
  notify();
  setTimeout(() => {
    toastQueue = toastQueue.filter((t) => t.id !== id);
    notify();
  }, 4000);
}

export function useToastState() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const subscribe = useCallback(() => {
    const handler = (next: Toast[]) => setToasts(next);
    toastListeners.push(handler);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== handler);
    };
  }, []);

  return { toasts, subscribe };
}
