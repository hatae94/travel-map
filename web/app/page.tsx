"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/app/providers/auth-provider";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { searchPlaces } from "@/lib/api/places";
import {
  getPlans,
  getPlan,
  createPlan,
  deletePlan as deletePlanApi,
  addPlanItem,
  removePlanItem,
} from "@/lib/api/travel-plans";
import type { Place, TravelPlan } from "@/lib/api/types";

import { Header } from "@/app/components/header";
import { Sidebar } from "@/app/components/sidebar";
import { LoginModal } from "@/app/components/login-modal";
import { SearchResults } from "@/app/components/search-results";
import { PlanList } from "@/app/components/plan-list";
import { PlanDetail } from "@/app/components/plan-detail";
import { CreatePlanModal } from "@/app/components/create-plan-modal";
import { AddItemModal } from "@/app/components/add-item-modal";

const MapView = dynamic(
  () => import("@/app/components/map-view").then((m) => m.MapView),
  { ssr: false },
);

export default function Home() {
  const { user } = useAuth();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Plans state
  const [activeTab, setActiveTab] = useState<"search" | "plans">("search");
  const [plans, setPlans] = useState<TravelPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<TravelPlan | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Mobile view toggle: "list" | "map"
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  // Modal state
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [addItemPlace, setAddItemPlace] = useState<Place | null>(null);

  // Search places
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setPlaces([]);
      setActiveIndex(null);
      return;
    }

    let cancelled = false;
    searchPlaces(debouncedQuery)
      .then((results) => {
        if (!cancelled) {
          setPlaces(results);
          setActiveIndex(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Search failed:", err);
          setPlaces([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Load plans when logged in or tab changes
  const loadPlans = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getPlans();
      setPlans(data);
    } catch (err) {
      console.error("Failed to load plans:", err);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadPlans();
  }, [user, loadPlans]);

  useEffect(() => {
    if (activeTab === "plans" && user) loadPlans();
  }, [activeTab, user, loadPlans]);

  // Plan detail
  const viewPlan = useCallback(async (id: string) => {
    try {
      const plan = await getPlan(id);
      setSelectedPlan(plan);
      setSelectedPlanId(id);
    } catch (err) {
      console.error("Failed to load plan:", err);
    }
  }, []);

  // Delete plan
  const handleDeletePlan = useCallback(
    async (id: string) => {
      if (!confirm("이 여행 계획을 삭제하시겠습니까?")) return;
      try {
        await deletePlanApi(id);
        await loadPlans();
        if (selectedPlanId === id) setSelectedPlan(null);
      } catch (err) {
        console.error("Failed to delete plan:", err);
      }
    },
    [loadPlans, selectedPlanId],
  );

  // Create plan
  const handleCreatePlan = useCallback(
    async (data: {
      title: string;
      description?: string;
      start_date?: string;
      end_date?: string;
    }) => {
      await createPlan(data);
      await loadPlans();
    },
    [loadPlans],
  );

  // Add item to plan
  const handleAddItem = useCallback(
    async (data: {
      place_node_id: number;
      memo?: string;
      visit_order?: number;
      visit_date?: string;
    }) => {
      const planId = selectedPlanId ?? plans[0]?.id;
      if (!planId) return;
      await addPlanItem(planId, data);
      setActiveTab("plans");
      await viewPlan(planId);
    },
    [selectedPlanId, plans, viewPlan],
  );

  // Remove item
  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      if (!selectedPlanId) return;
      try {
        await removePlanItem(selectedPlanId, itemId);
        await viewPlan(selectedPlanId);
      } catch (err) {
        console.error("Failed to remove item:", err);
      }
    },
    [selectedPlanId, viewPlan],
  );

  // Add to plan (from search)
  const handleAddToPlan = useCallback(
    (place: Place) => {
      if (!plans.length) {
        alert("먼저 여행 계획을 생성하세요.");
        return;
      }
      if (!selectedPlanId) setSelectedPlanId(plans[0].id);
      setAddItemPlace(place);
    },
    [plans, selectedPlanId],
  );

  const handleMarkerClick = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  return (
    <>
      <LoginModal />
      <CreatePlanModal
        open={showCreatePlan}
        onClose={() => setShowCreatePlan(false)}
        onSubmit={handleCreatePlan}
      />
      <AddItemModal
        open={!!addItemPlace}
        onClose={() => setAddItemPlace(null)}
        place={addItemPlace}
        plans={plans}
        selectedPlanId={selectedPlanId}
        onSelectPlan={setSelectedPlanId}
        onSubmit={handleAddItem}
      />

      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar: visible on desktop always, on mobile only when mobileView=list */}
        <div
          className={`${mobileView === "list" ? "flex" : "hidden"} w-full md:flex md:w-auto`}
        >
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchContent={
              <SearchResults
                places={places}
                activeIndex={activeIndex}
                onSelect={(i) => {
                  setActiveIndex(i);
                  setMobileView("map");
                }}
                onAddToPlan={handleAddToPlan}
                isLoggedIn={!!user}
              />
            }
            plansContent={
              selectedPlan ? (
                <PlanDetail
                  plan={selectedPlan}
                  onBack={() => setSelectedPlan(null)}
                  onRemoveItem={handleRemoveItem}
                />
              ) : (
                <PlanList
                  plans={plans}
                  onView={viewPlan}
                  onDelete={handleDeletePlan}
                  onCreate={() => setShowCreatePlan(true)}
                />
              )
            }
          />
        </div>

        {/* Map: visible on desktop always, on mobile only when mobileView=map */}
        <div
          className={`${mobileView === "map" ? "flex" : "hidden"} flex-1 md:flex`}
        >
          <MapView
            places={places}
            activeIndex={activeIndex}
            onMarkerClick={handleMarkerClick}
            visible={mobileView === "map"}
          />
        </div>

        {/* Mobile toggle button */}
        <button
          onClick={() =>
            setMobileView((v) => (v === "list" ? "map" : "list"))
          }
          className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg active:bg-blue-600 md:hidden"
        >
          {mobileView === "list" ? "지도 보기" : "목록 보기"}
        </button>
      </div>
    </>
  );
}
