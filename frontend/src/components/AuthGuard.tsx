"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const ran = useRef(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;

        (async () => {
            try {
                // 1) refresh เพื่อให้ได้ access (อาศัย cookie)
                const r = await api.post("/api/auth/refresh/", null);
                const access = r.data?.access as string;

                // 2) set access ก่อน แล้วค่อยเรียก me
                useAuthStore.getState().setAuth(access, useAuthStore.getState().user || ({} as any));

                // 3) me
                const m = await api.get("/api/auth/me/");
                const user = m.data;

                // 4) set auth (access + user)
                useAuthStore.getState().setAuth(access, user);

                setReady(true);
            } catch {
                useAuthStore.getState().clear();
                router.replace("/login");
            }
        })();
    }, [router]);

    if (!ready) return <div className="p-6">Loading...</div>;
    return <>{children}</>;
}
