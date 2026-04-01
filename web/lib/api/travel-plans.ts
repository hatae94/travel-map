import { apiFetch } from "./client";
import type { TravelPlan, CreatePlanInput, AddItemInput } from "./types";

export async function getPlans(): Promise<TravelPlan[]> {
  return apiFetch<TravelPlan[]>("/travel-plans");
}

export async function getPlan(id: string): Promise<TravelPlan> {
  return apiFetch<TravelPlan>(`/travel-plans/${id}`);
}

export async function createPlan(input: CreatePlanInput): Promise<TravelPlan> {
  return apiFetch<TravelPlan>("/travel-plans", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updatePlan(
  id: string,
  input: Partial<CreatePlanInput>,
): Promise<TravelPlan> {
  return apiFetch<TravelPlan>(`/travel-plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deletePlan(id: string): Promise<void> {
  await apiFetch(`/travel-plans/${id}`, { method: "DELETE" });
}

export async function addPlanItem(
  planId: string,
  input: AddItemInput,
): Promise<void> {
  await apiFetch(`/travel-plans/${planId}/items`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function removePlanItem(
  planId: string,
  itemId: string,
): Promise<void> {
  await apiFetch(`/travel-plans/${planId}/items/${itemId}`, {
    method: "DELETE",
  });
}
