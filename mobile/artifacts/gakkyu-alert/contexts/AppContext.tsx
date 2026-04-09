import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { PREFECTURES, TOKYO_DISTRICTS, type Prefecture } from "@/constants/data";
import { LoadingScreen } from "@/components/LoadingScreen";

// 旧データ移行: Tokyo 区市 ID → "tokyo" に統一
const TOKYO_DISTRICT_IDS = new Set(TOKYO_DISTRICTS.map((d) => d.id));
function migrateHomeId(id: string | null): string | null {
  if (!id) return null;
  return TOKYO_DISTRICT_IDS.has(id) ? "tokyo" : id;
}

export interface Child {
  id: string;
  nickname: string;
  age: number;
}

export interface NotificationSettings {
  enabled: boolean;
  alertLevel: 2 | 3;
  weeklyDay: number;
  weeklyHour: number;
}

interface AppState {
  isOnboarded: boolean;
  homeDistrictId: string | null;
  extraDistrictIds: string[];
  children: Child[];
  notifications: NotificationSettings;
  hasAccount: boolean;
}

interface AppContextType extends AppState {
  homeDistrict: Prefecture | null;
  setHomeDistrict: (id: string) => void;
  completeOnboarding: (districtId: string) => void;
  addChild: (child: Omit<Child, "id">) => void;
  removeChild: (id: string) => void;
  updateChild: (id: string, updates: Partial<Omit<Child, "id">>) => void;
  addExtraDistrict: (id: string) => void;
  removeExtraDistrict: (id: string) => void;
  updateNotifications: (updates: Partial<NotificationSettings>) => void;
  resetApp: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = "@gakkyu_alert_state";

const DEFAULT_STATE: AppState = {
  isOnboarded: false,
  homeDistrictId: null,
  extraDistrictIds: [],
  children: [],
  notifications: {
    enabled: false,
    alertLevel: 2,
    weeklyDay: 1,
    weeklyHour: 7,
  },
  hasAccount: false,
};

export function AppProvider({ children: reactChildren }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          // 旧 Tokyo 区市 ID を都道府県 ID に移行
          parsed.homeDistrictId = migrateHomeId(parsed.homeDistrictId ?? null);
          setState({ ...DEFAULT_STATE, ...parsed });
        } catch {
          // ignore
        }
      }
      setLoaded(true);
    });
  }, []);

  const save = useCallback((next: AppState) => {
    setState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const homeDistrict = state.homeDistrictId
    ? (PREFECTURES.find((p) => p.id === state.homeDistrictId) ?? null)
    : null;

  const setHomeDistrict = useCallback(
    (id: string) => save({ ...state, homeDistrictId: id }),
    [state, save]
  );

  const completeOnboarding = useCallback(
    (districtId: string) =>
      save({ ...state, homeDistrictId: districtId, isOnboarded: true }),
    [state, save]
  );

  const addChild = useCallback(
    (child: Omit<Child, "id">) => {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      save({ ...state, children: [...state.children, { ...child, id }] });
    },
    [state, save]
  );

  const removeChild = useCallback(
    (id: string) =>
      save({ ...state, children: state.children.filter((c) => c.id !== id) }),
    [state, save]
  );

  const updateChild = useCallback(
    (id: string, updates: Partial<Omit<Child, "id">>) =>
      save({
        ...state,
        children: state.children.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      }),
    [state, save]
  );

  const addExtraDistrict = useCallback(
    (id: string) => {
      if (!state.extraDistrictIds.includes(id)) {
        save({ ...state, extraDistrictIds: [...state.extraDistrictIds, id] });
      }
    },
    [state, save]
  );

  const removeExtraDistrict = useCallback(
    (id: string) =>
      save({
        ...state,
        extraDistrictIds: state.extraDistrictIds.filter((d) => d !== id),
      }),
    [state, save]
  );

  const updateNotifications = useCallback(
    (updates: Partial<NotificationSettings>) =>
      save({ ...state, notifications: { ...state.notifications, ...updates } }),
    [state, save]
  );

  const resetApp = useCallback(() => {
    AsyncStorage.removeItem(STORAGE_KEY);
    setState(DEFAULT_STATE);
  }, []);

  if (!loaded) return <LoadingScreen />;

  return (
    <AppContext.Provider
      value={{
        ...state,
        homeDistrict,
        setHomeDistrict,
        completeOnboarding,
        addChild,
        removeChild,
        updateChild,
        addExtraDistrict,
        removeExtraDistrict,
        updateNotifications,
        resetApp,
      }}
    >
      {reactChildren}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
