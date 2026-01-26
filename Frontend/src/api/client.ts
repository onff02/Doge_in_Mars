import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE_URL = "http://43.202.45.31:3000";
export const AUTH_TOKEN_KEY = "auth_token";
export const AUTH_USER_KEY = "auth_user";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
};

export type AuthUser = {
  id: number;
  email: string;
  nickname: string;
  introViewed: boolean;
  createdAt: string;
};

export type LoginResponse = {
  user: AuthUser;
  token: string;
  hasActiveSession: boolean;
  introViewed: boolean;
};

export type RegisterResponse = {
  user: AuthUser;
  token: string;
};

export type Rocket = {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  rawStats?: {
    PER: number;
    PBR: number;
    ROE: number;
  };
  gameStats?: {
    boost: { value: number };
    armor: { value: number };
    fuelEco: { value: number };
  };
};

export type ChartResponse = {
  symbol: string;
  name: string;
  description: string;
  gravityData: {
    timestamps: number[];
    values: number[];
    stability: number[];
  };
  meta?: {
    volatility?: number;
    currentPrice?: number;
    priceChange24h?: number;
    dataPoints?: number;
    interval?: string;
  };
};

export type FlightStatusResponse = {
  introViewed: boolean;
  hasActiveSession: boolean;
  activeSession: {
    id: number;
    rocket: Rocket;
    currentFuel: number;
    currentHull: number;
    distance: number;
    symbol: string;
    progress: number;
    logCount: number;
  } | null;
};

export type FlightStartResponse = {
  session: {
    id: number;
    rocket: Rocket;
    currentFuel: number;
    currentHull: number;
    distance: number;
    symbol: string;
    targetDistance: number;
  };
  message: string;
};

export type FlightSyncResponse = {
  currentFuel: number;
  currentHull: number;
  distance: number;
  progress: number;
  fuelConsumed: number;
  distanceChange: number;
  hullDamage: number;
  isStableZone: boolean;
  changeRate: number;
  status: string;
  isGameOver: boolean;
  gameOverReason: string;
};

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function saveAuthSession(payload: { token: string; user: AuthUser }): Promise<void> {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, payload.token);
  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(payload.user));
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  await AsyncStorage.removeItem(AUTH_USER_KEY);
}

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = await getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json: ApiEnvelope<T> | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const message = json?.error || json?.message || response.statusText || "Request failed";
    throw new Error(message);
  }

  if (json && json.success === false) {
    const message = json.error || json.message || "Request failed";
    throw new Error(message);
  }

  if (!json) {
    throw new Error("Empty response from server");
  }

  return (json.data ?? json) as T;
}

export async function registerUser(params: {
  email: string;
  password: string;
  nickname: string;
}): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>("/api/auth/register", { method: "POST", body: params });
}

export async function loginUser(params: { email: string; password: string }): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/auth/login", { method: "POST", body: params });
}

export async function markIntroComplete(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/api/flight/intro-complete", { method: "POST", auth: true, body: {} });
}

export async function getRockets(): Promise<{ rockets: Rocket[] }> {
  return apiRequest<{ rockets: Rocket[] }>("/api/rockets");
}

export async function getChart(symbol: string, points = 120): Promise<ChartResponse> {
  const query = `?points=${encodeURIComponent(points)}`;
  return apiRequest<ChartResponse>(`/api/charts/${encodeURIComponent(symbol)}${query}`);
}

export async function getFlightStatus(): Promise<FlightStatusResponse> {
  return apiRequest<FlightStatusResponse>("/api/flight/status", { auth: true });
}

export async function startFlight(params: { rocketId: number; symbol: string }): Promise<FlightStartResponse> {
  return apiRequest<FlightStartResponse>("/api/flight/start", { method: "POST", body: params, auth: true });
}

export async function syncFlight(params: {
  fuelInput: number;
  yValue: number;
  previousYValue?: number;
}): Promise<FlightSyncResponse> {
  return apiRequest<FlightSyncResponse>("/api/flight/sync", { method: "POST", body: params, auth: true });
}
