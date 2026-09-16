import { Platform } from "react-native";

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string;
const API = `${BACKEND_URL}/api`;

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: any; skipAuthRedirect?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isForm) headers["Content-Type"] = "application/json";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(`${API}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: isForm ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401 && !options.skipAuthRedirect) {
    onUnauthorized?.();
  }
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const detail = data?.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d: any) => d.msg).join(", ")
      : typeof detail === "string"
        ? detail
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export function fileUrl(pathOrUrl: string) {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  return `${BACKEND_URL}${pathOrUrl}`;
}

export async function uploadImage(uri: string, name = "photo.jpg", type = "image/jpeg") {
  return uploadFile(uri, name, type);
}

export async function uploadFile(uri: string, name: string, type: string) {
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type } as any);
  }
  return api<{ path: string; url: string }>("/upload", { method: "POST", body: form });
}

// ---------- Types ----------
export type Role = "homeowner" | "tenant";
export type Period = "week" | "month" | "year";

export interface User {
  user_id: string;
  email?: string;
  name: string;
  role: Role | null;
  bio: string;
  phone: string;
  whatsapp: string;
  picture: string;
  city: string;
  country: string;
  stats?: { listings: number; reviews: number; rating: number | null };
}

export interface UserSummary {
  user_id: string;
  name: string;
  role: Role | null;
  picture: string;
  phone: string;
  whatsapp: string;
  bio: string;
  city: string;
  country: string;
}

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export interface Listing {
  listing_id: string;
  owner_id: string;
  title: string;
  description: string;
  address: string;
  city: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  price: number;
  currency: string;
  currency_symbol: string;
  period: Period;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  photos: string[];
  created_at: string;
  owner: UserSummary | null;
  offers_count: number;
  reviews_count: number;
  rating: number | null;
  is_mine: boolean;
  is_favorited: boolean;
  distance_km: number | null;
  status: "available" | "rented";
  video: string | null;
}

export type OfferStatus = "pending" | "accepted" | "declined" | "closed";

export interface Conversation {
  conversation_id: string;
  listing_id: string;
  owner_id: string;
  tenant_id: string;
  last_message: string;
  last_message_at: string;
  created_at: string;
  other: UserSummary | null;
  listing: { listing_id: string; title: string; photos: string[]; status?: string } | null;
  unread: number;
}

export interface Message {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

export interface ListingFilters {
  q?: string;
  period?: Period | "";
  min_price?: string;
  max_price?: string;
  bedrooms?: number;
  property_type?: string;
  near?: { lat: number; lng: number; radius_km: number } | null;
}

export function buildListingQuery(f: ListingFilters) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.period) p.set("period", f.period);
  if (f.min_price) p.set("min_price", f.min_price);
  if (f.max_price) p.set("max_price", f.max_price);
  if (f.bedrooms) p.set("bedrooms", String(f.bedrooms));
  if (f.property_type) p.set("property_type", f.property_type);
  if (f.near) {
    p.set("lat", String(f.near.lat));
    p.set("lng", String(f.near.lng));
    p.set("radius_km", String(f.near.radius_km));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export interface Offer {
  offer_id: string;
  listing_id: string;
  tenant_id: string;
  amount: number;
  currency: string;
  currency_symbol: string;
  period: Period;
  message: string;
  status: OfferStatus;
  created_at: string;
  tenant: UserSummary | null;
  listing?: Listing | null;
}

export interface Reply {
  reply_id: string;
  review_id: string;
  author_id: string;
  text: string;
  created_at: string;
  author: UserSummary | null;
}

export interface Review {
  review_id: string;
  listing_id: string;
  owner_id: string;
  author_id: string;
  rating: number;
  text: string;
  created_at: string;
  author: UserSummary | null;
  listing: { listing_id: string; title: string } | null;
  replies: Reply[];
}

export interface PlaceResult {
  description: string;
  name: string;
  lat: number;
  lng: number;
  country_code: string;
  country: string;
  city: string;
  source: string;
  currency: Currency | null;
}
