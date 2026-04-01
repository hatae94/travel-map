"use client";

import { useState } from "react";
import { Modal, ModalField, ModalActions, inputClass } from "./modal";

interface CreatePlanModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    start_date?: string;
    end_date?: string;
  }) => Promise<void>;
}

export function CreatePlanModal({
  open,
  onClose,
  onSubmit,
}: CreatePlanModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      onClose();
    } catch (err) {
      console.error("Failed to create plan:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="새 여행 계획">
      <ModalField label="제목 *">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 제주도 3박 4일"
          className={inputClass}
        />
      </ModalField>
      <ModalField label="설명">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="여행 설명"
          className={`${inputClass} min-h-[60px] resize-y`}
        />
      </ModalField>
      <ModalField label="시작일">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={inputClass}
        />
      </ModalField>
      <ModalField label="종료일">
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className={inputClass}
        />
      </ModalField>
      <ModalActions>
        <button
          onClick={onClose}
          className="rounded-md border border-gray-200 bg-white px-3.5 py-1.5 text-[13px] hover:bg-gray-50"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim()}
          className="rounded-md bg-blue-500 px-3.5 py-1.5 text-[13px] text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {submitting ? "생성 중..." : "생성"}
        </button>
      </ModalActions>
    </Modal>
  );
}
