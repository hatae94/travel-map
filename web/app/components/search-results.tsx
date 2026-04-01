"use client";

import type { Place } from "@/lib/api/types";

interface SearchResultsProps {
  places: Place[];
  activeIndex: number | null;
  onSelect: (index: number) => void;
  onAddToPlan: (place: Place) => void;
  isLoggedIn: boolean;
}

export function SearchResults({
  places,
  activeIndex,
  onSelect,
  onAddToPlan,
  isLoggedIn,
}: SearchResultsProps) {
  if (places.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        검색 결과가 없습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {places.map((place, i) => {
        const name = place.name_ko ?? place.name;
        const addr = [
          place.addr_province,
          place.addr_city,
          place.addr_district,
          place.addr_suburb,
          place.addr_street,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={place.osm_id}
            onClick={() => onSelect(i)}
            className={`cursor-pointer rounded-lg border bg-white p-3 transition-colors ${
              activeIndex === i
                ? "border-blue-400 bg-blue-50"
                : "border-gray-100 hover:border-blue-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                {name}
                {place.type && (
                  <span className="font-normal text-gray-500">
                    {" "}
                    &middot; {place.type}
                  </span>
                )}
              </span>
              {place.rrf_score != null && place.rrf_score > 0 && (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-500">
                  {(place.rrf_score * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              {addr || "주소 정보 없음"}
            </p>
            {isLoggedIn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToPlan(place);
                }}
                className="mt-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs hover:border-blue-400 hover:bg-blue-50"
              >
                계획에 추가
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
