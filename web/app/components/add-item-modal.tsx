"use client";

import { useState } from "react";
import { Modal, ModalField, ModalActions, inputClass } from "./modal";
import type { Place, TravelPlan } from "@/lib/api/types";

interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  place: Place | null;
  plans: TravelPlan[];
  selectedPlanId: string | null;
  onSelectPlan: (id: string) => void;
  onSubmit: (data: {
    place_node_id: number;
    memo?: string;
    visit_order?: number;
    visit_date?: string;
  }) => Promise<void>;
}

export function AddItemModal({
  open,
  onClose,
  place,
  plans,
  selectedPlanId,
  onSelectPlan,
  onSubmit,
}: AddItemModalProps) {
  const [memo, setMemo] = useState("");
  const [order, setOrder] = useState("1");
  const [visitDate, setVisitDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!place) return null;

  const name = place.name_ko ?? place.name;

  async function handleSubmit() {
    if (!place || !selectedPlanId) return;
    setSubmitting(true);
    try {
      await onSubmit({
        place_node_id: Number(place.osm_id),
        memo: memo.trim() || name,
        visit_order: Number(order) || 1,
        visit_date: visitDate || undefined,
      });
      setMemo("");
      setOrder("1");
      setVisitDate("");
      onClose();
    } catch (err) {
      console.error("Failed to add item:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="장소 추가">
      <p className="mb-3 text-[13px] text-gray-500">{name}</p>

      {plans.length > 1 && (
        <ModalField label="여행 계획 선택">
          <select
            value={selectedPlanId ?? ""}
            onChange={(e) => onSelectPlan(e.target.value)}
            className={inputClass}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </ModalField>
      )}

      <ModalField label="메모">
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예: 꼭 가봐야 할 곳"
          className={inputClass}
        />
      </ModalField>
      <ModalField label="방문 순서">
        <input
          type="number"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          min={1}
          className={inputClass}
        />
      </ModalField>
      <ModalField label="방문 예정일">
        <input
          type="date"
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
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
          disabled={submitting}
          className="rounded-md bg-blue-500 px-3.5 py-1.5 text-[13px] text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {submitting ? "추가 중..." : "추가"}
        </button>
      </ModalActions>
    </Modal>
  );
}
