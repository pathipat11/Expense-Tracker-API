import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export async function login(payload: { email?: string; username?: string; password: string }) {
    const res = await api.post("/api/auth/login/", payload);
    const access = res.data.access as string;
    const user = res.data.user;
    useAuthStore.getState().setAuth(access, user);
    return user;
}

export async function me() {
    const res = await api.get("/api/auth/me/");
    return res.data;
}

export async function logout() {
    try {
        await api.post("/api/auth/logout/", null);
    } finally {
        useAuthStore.getState().clear();
    }
}

export async function bootstrapAuth() {
    try {
        // 1) ขอ access ใหม่จาก refresh cookie
        const r = await api.post("/api/auth/refresh/", null);
        const access = r.data.access as string;

        // 2) ดึงข้อมูล user
        const meRes = await api.get("/api/auth/me/");
        const user = meRes.data;

        // 3) set กลับเข้า store
        useAuthStore.getState().setAuth(access, user);
        return user;
    } catch {
        useAuthStore.getState().clear();
        throw new Error("Not authenticated");
    }
}