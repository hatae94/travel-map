export interface Place {
  osm_id: string;
  name: string;
  name_ko: string | null;
  name_en: string | null;
  category: string | null;
  type: string | null;
  phone: string | null;
  addr_full: string | null;
  addr_province: string | null;
  addr_city: string | null;
  addr_district: string | null;
  addr_suburb: string | null;
  addr_street: string | null;
  addr_housenumber: string | null;
  longitude: number;
  latitude: number;
  score: number;
  rrf_score?: number;
}

export interface TravelPlan {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  items?: TravelPlanItem[];
}

export interface TravelPlanItem {
  id: string;
  place_node_id: number;
  memo: string | null;
  visit_order: number;
  visit_date: string | null;
  created_at: string;
}

export interface CreatePlanInput {
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
}

export interface AddItemInput {
  place_node_id: number;
  memo?: string;
  visit_order?: number;
  visit_date?: string;
}

export interface AuthResponse {
  access_token: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  nickname: string;
  exp: number;
}
