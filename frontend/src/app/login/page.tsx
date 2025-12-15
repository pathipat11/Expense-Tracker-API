"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        try {
            await login({ email, password });
            router.replace("/dashboard");
        } catch {
            setErr("Login failed");
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border p-6">
                <h1 className="text-xl font-semibold">Login</h1>
                <input className="w-full rounded-xl border p-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="w-full rounded-xl border p-3" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                {err && <p className="text-sm text-red-600">{err}</p>}
                <button className="w-full rounded-xl bg-black text-white p-3">Sign in</button>
            </form>
        </div>
    );
}
