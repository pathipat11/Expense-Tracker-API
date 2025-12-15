/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

export const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // ส่ง cookie refresh ไปด้วย
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

let refreshing: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
    const res = await api.post("/api/auth/refresh/", null);
    const access = res.data?.access as string;
    if (!access) throw new Error("Missing access token from refresh");
    return access;
}

api.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
        const original = error.config as any;
        if (!original) throw error;

        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;

            try {
                if (!refreshing) refreshing = refreshAccessToken().finally(() => (refreshing = null));
                const newAccess = await refreshing;

                const { user } = useAuthStore.getState();
                if (user) useAuthStore.getState().setAuth(newAccess, user);

                original.headers.Authorization = `Bearer ${newAccess}`;
                return api(original);
            } catch {
                useAuthStore.getState().clear();
                throw error;
            }
        }

        throw error;
    }
);
