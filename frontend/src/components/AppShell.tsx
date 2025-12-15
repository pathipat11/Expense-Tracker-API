"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { useAuthStore } from "@/store/auth";

const NAV = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/transactions", label: "Transactions" },
    { href: "/budgets", label: "Budgets" },
    { href: "/reports", label: "Reports" },
    { href: "/insights", label: "Insights (AI)" },
    { href: "/wallets", label: "Wallets" },
    { href: "/categories", label: "Categories" },
    { href: "/recurring", label: "Recurring" },
    { href: "/settings", label: "Settings" },
];

function cx(...s: Array<string | false | null | undefined>) {
    return s.filter(Boolean).join(" ");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const user = useAuthStore((s) => s.user);

    async function onLogout() {
        await logout();
        router.replace("/login");
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-6xl p-4">
                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
                    {/* Sidebar */}
                    <aside className="rounded-2xl border bg-white p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-lg font-semibold">Expense Tracker</div>
                                <div className="text-xs text-gray-500">Full-stack • Next.js + Django</div>
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl bg-gray-50 p-3">
                            <div className="text-xs text-gray-500">Signed in as</div>
                            <div className="text-sm font-medium">{user?.username ?? "—"}</div>
                            <div className="text-xs text-gray-500">{user?.email ?? ""}</div>
                        </div>

                        <nav className="mt-4 space-y-1">
                            {NAV.map((item) => {
                                const active =
                                    pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cx(
                                            "block rounded-xl px-3 py-2 text-sm transition",
                                            active ? "bg-black text-white" : "hover:bg-gray-100 text-gray-700"
                                        )}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>

                        <button
                            onClick={onLogout}
                            className="mt-4 w-full rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                        >
                            Logout
                        </button>
                    </aside>

                    {/* Main */}
                    <main className="rounded-2xl border bg-white">
                        {/* Topbar */}
                        <div className="flex items-center justify-between border-b p-4">
                            <div className="text-sm text-gray-600">
                                {pathname}
                            </div>
                            <div className="text-sm text-gray-600">
                                Tip: Start from Transactions → Budgets → Reports → AI
                            </div>
                        </div>

                        <div className="p-6">{children}</div>
                    </main>
                </div>
            </div>
        </div>
    );
}
