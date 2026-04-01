"use client";

import type { TravelPlan } from "@/lib/api/types";

interface PlanListProps {
  plans: TravelPlan[];
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

export function PlanList({ plans, onView, onDelete, onCreate }: PlanListProps) {
  return (
    <div>
      <button
        onClick={onCreate}
        className="mb-3 w-full rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
      >
        + 새 여행 계획
      </button>

      {plans.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">
          여행 계획이 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-lg border border-gray-100 bg-white p-3.5"
            >
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
              <div className="mt-2.5 flex gap-1.5">
                <button
                  onClick={() => onView(plan.id)}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs hover:border-blue-400 hover:bg-blue-50"
                >
                  상세보기
                </button>
                <button
                  onClick={() => onDelete(plan.id)}
                  className="rounded-md border border-red-400 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
