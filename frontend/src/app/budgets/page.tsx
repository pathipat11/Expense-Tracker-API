"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import {
    Budget,
    BudgetStatusResponse,
    createBudget,
    deleteBudget,
    getBudgetStatus,
    listBudgets,
} from "@/lib/budgets";
import { listCategories, Category } from "@/lib/categories";

function yyyyMmNow() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

export default function BudgetsPage() {
    const [month, setMonth] = useState(yyyyMmNow());
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [status, setStatus] = useState<BudgetStatusResponse | null>(null);
    const [cats, setCats] = useState<Category[]>([]);

    const [scope, setScope] = useState<"total" | "category">("total");
    const [limit, setLimit] = useState("1000.00");
    const [categoryId, setCategoryId] = useState<number | "">("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    async function load() {
        setLoading(true);
        try {
            const [b, s, c] = await Promise.all([
                listBudgets(month),
                getBudgetStatus(month),
                listCategories("expense").catch(() => [] as Category[]),
            ]);
            setBudgets(b);
            setStatus(s);
            setCats(c);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month]);

    async function onCreate() {
        setSaving(true);
        try {
            const payload: any = {
                month,
                scope,
                limit_base_amount: limit,
            };
            if (scope === "category") payload.category_id = categoryId || null;

            await createBudget(payload);
            await load();
        } catch (e: any) {
            alert("Create budget failed (check scope/category/validation)");
        } finally {
            setSaving(false);
        }
    }

    async function onDelete(id: number) {
        if (!confirm("Delete this budget?")) return;
        await deleteBudget(id);
        await load();
    }

    const baseCurrency = status?.base_currency || "—";

    return (
        <ProtectedLayout>
            <div className="p-6 space-y-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Budgets</h1>
                        <p className="text-sm text-gray-600">
                            Month-based budgets • currency: <span className="font-medium">{baseCurrency}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600">Month</label>
                        <input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="rounded-xl border px-3 py-2"
                        />
                        <button onClick={load} className="rounded-xl border px-4 py-2 hover:bg-gray-50">
                            Refresh
                        </button>
                    </div>
                </div>

                {/* STATUS */}
                <section className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold">Status</h2>
                        <span className="text-sm text-gray-600">{status?.month || month}</span>
                    </div>

                    {loading ? (
                        <div className="p-4 text-sm text-gray-600">Loading...</div>
                    ) : !status || status.items.length === 0 ? (
                        <div className="p-4 text-sm text-gray-600">No budgets for this month.</div>
                    ) : (
                        <div className="mt-3 space-y-3">
                            {status.items.map((it) => (
                                <StatusRow key={it.budget_id} it={it} currency={baseCurrency} />
                            ))}
                        </div>
                    )}
                </section>

                {/* CREATE */}
                <section className="rounded-2xl border p-4 space-y-3">
                    <h2 className="font-semibold">Create Budget</h2>

                    <div className="grid gap-3 sm:grid-cols-4">
                        <div className="space-y-1">
                            <div className="text-sm text-gray-600">Scope</div>
                            <select
                                value={scope}
                                onChange={(e) => {
                                    const v = e.target.value as "total" | "category";
                                    setScope(v);
                                    if (v === "total") setCategoryId("");
                                }}
                                className="w-full rounded-xl border px-3 py-2"
                            >
                                <option value="total">Total</option>
                                <option value="category">Category</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <div className="text-sm text-gray-600">Limit ({baseCurrency})</div>
                            <input
                                value={limit}
                                onChange={(e) => setLimit(e.target.value)}
                                className="w-full rounded-xl border px-3 py-2"
                                placeholder="e.g. 15000.00"
                            />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                            <div className="text-sm text-gray-600">Category (expense)</div>
                            <select
                                disabled={scope !== "category"}
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
                                className="w-full rounded-xl border px-3 py-2 disabled:bg-gray-50"
                            >
                                <option value="">—</option>
                                {cats.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                            {scope === "category" && cats.length === 0 && (
                                <div className="text-xs text-amber-700">
                                    *ยังโหลด categories ไม่ได้ (ถ้า endpoint ไม่ใช่ /api/categories/ ให้บอกผม)
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={onCreate}
                        disabled={saving || (scope === "category" && !categoryId)}
                        className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-60"
                    >
                        {saving ? "Creating..." : "Create"}
                    </button>
                </section>

                {/* LIST */}
                <section className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold">Budgets List</h2>
                        <span className="text-sm text-gray-600">{budgets.length} items</span>
                    </div>

                    {loading ? (
                        <div className="p-4 text-sm text-gray-600">Loading...</div>
                    ) : budgets.length === 0 ? (
                        <div className="p-4 text-sm text-gray-600">No budgets yet.</div>
                    ) : (
                        <div className="mt-3 divide-y">
                            {budgets.map((b) => (
                                <div key={b.id} className="py-3 flex items-center justify-between gap-4">
                                    <div>
                                        <div className="font-medium">
                                            {b.scope === "total" ? "Total" : `Category: ${b.category?.name ?? "—"}`}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            Limit: {b.limit_base_amount} {baseCurrency}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onDelete(b.id)}
                                        className="rounded-xl border px-3 py-2 hover:bg-gray-50"
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </ProtectedLayout>
    );
}

function StatusRow({
    it,
    currency,
}: {
    it: {
        title: string;
        limit: string;
        spent: string;
        remaining: string;
        percent_used: string;
    };
    currency: string;
}) {
    const pct = Math.max(0, Math.min(100, Number(it.percent_used)));

    return (
        <div className="rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="font-medium">{it.title}</div>
                    <div className="text-sm text-gray-600 mt-1">
                        Spent: {it.spent} {currency} • Limit: {it.limit} {currency} • Remaining: {it.remaining} {currency}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-sm text-gray-600">Used</div>
                    <div className="font-semibold">{pct.toFixed(2)}%</div>
                </div>
            </div>

            <div className="mt-3 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-black" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
