"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className="w-[400px] max-w-[90vw] rounded-xl bg-white p-6">
        <h2 className="mb-4 text-base font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ModalField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2.5">
      <label className="mb-1 block text-[13px] text-gray-500">{label}</label>
      {children}
    </div>
  );
}

export function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 flex justify-end gap-2">{children}</div>;
}

export const inputClass =
  "w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 font-[inherit]";
