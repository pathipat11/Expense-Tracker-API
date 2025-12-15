import { create } from "zustand";

type User = {
    id: number;
    username: string;
    email: string;
    profile?: { base_currency?: string };
};

type AuthState = {
    accessToken: string | null;
    user: User | null;
    setAuth: (accessToken: string, user: User) => void;
    clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
    accessToken: null,
    user: null,
    setAuth: (accessToken, user) => set({ accessToken, user }),
    clear: () => set({ accessToken: null, user: null }),
}));
