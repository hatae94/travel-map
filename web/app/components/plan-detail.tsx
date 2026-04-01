"use client";

import type { TravelPlan } from "@/lib/api/types";

interface PlanDetailProps {
  plan: TravelPlan;
  onBack: () => void;
  onRemoveItem: (itemId: string) => void;
}

export function PlanDetail({ plan, onBack, onRemoveItem }: PlanDetailProps) {
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-3 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs hover:border-blue-400 hover:bg-blue-50"
      >
        &larr; 목록으로
      </button>

      <div className="rounded-lg border border-gray-100 bg-white p-3.5">
        <h3 className="text-[15px] font-semibold text-gray-900">
          {plan.title}
        </h3>
        <p className="text-xs text-gray-400">
          {plan.start_date ?? "미정"} ~ {plan.end_date ?? "미정"}
        </p>
        {plan.description && (
          <p className="mt-1.5 text-[13px] text-gray-500">
            {plan.description}
          </p>
        )}

        <div className="mt-2.5 border-t border-gray-100 pt-2.5">
          <strong className="text-[13px]">
            장소 목록 ({plan.items?.length ?? 0}개)
          </strong>

          {!plan.items?.length ? (
            <p className="py-4 text-center text-sm text-gray-400">
              검색 탭에서 장소를 추가하세요
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {plan.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-1.5 text-[13px]"
                >
                  <div>
                    <span className="mr-2 font-semibold text-blue-500">
                      #{item.visit_order}
                    </span>
                    {item.memo ?? `장소 ID: ${item.place_node_id}`}
                    {item.visit_date && (
                      <span className="ml-1 text-[11px] text-gray-400">
                        ({item.visit_date})
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="rounded-md border border-red-400 px-2 py-0.5 text-xs text-red-500 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
