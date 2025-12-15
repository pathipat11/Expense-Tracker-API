"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import {
    getReportsByCategory,
    getReportsSummary,
    getReportsTrend,
    ReportsByCategoryResponse,
    ReportsSummary,
    ReportsTrendResponse,
} from "@/lib/reports";

import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Tooltip,
    Legend,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    BarChart,
    Bar,
} from "recharts";

function yyyyMmNow() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

function num(x: string | number) {
    const n = typeof x === "number" ? x : Number(x);
    return Number.isFinite(n) ? n : 0;
}

export default function ReportsPage() {
    const [month, setMonth] = useState(yyyyMmNow());

    const [summary, setSummary] = useState<ReportsSummary | null>(null);
    const [cat, setCat] = useState<ReportsByCategoryResponse | null>(null);
    const [trend, setTrend] = useState<ReportsTrendResponse | null>(null);
    const [interval, setInterval] = useState<"daily" | "weekly" | "monthly">("daily");

    const [loading, setLoading] = useState(true);
    const [warn, setWarn] = useState<string[]>([]);

    async function load() {
        setLoading(true);
        setWarn([]);

        const warns: string[] = [];

        const s = await getReportsSummary(month).catch(() => {
            warns.push("Summary endpoint not ready (or path mismatch).");
            return null;
        });

        const c = await getReportsByCategory(month, "expense").catch(() => {
            warns.push("By-category endpoint not ready (or path mismatch).");
            return null;
        });

        const t = await getReportsTrend(month, interval).catch(() => {
            warns.push("Trend endpoint not ready (or path mismatch).");
            return null;
        });

        setSummary(s);
        setCat(c);
        setTrend(t);

        setWarn(warns);
        setLoading(false);
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, interval]);

    const currency = summary?.base_currency || cat?.base_currency || trend?.base_currency || "—";

    const pieData = useMemo(() => {
        const items = cat?.items ?? [];
        return items
            .filter((x) => num(x.total) > 0)
            .map((x) => ({
                name: x.category_name || "Uncategorized",
                value: num(x.total),
            }))
            .slice(0, 12);
    }, [cat]);

    const barData = useMemo(() => {
        const items = cat?.items ?? [];
        return items
            .slice()
            .sort((a, b) => num(b.total) - num(a.total))
            .slice(0, 10)
            .map((x) => ({
                name: x.category_name || "Uncategorized",
                amount: num(x.total),
            }));
    }, [cat]);

    const trendData = useMemo(() => {
        const items = trend?.items ?? [];

        // ✅ daily: เติมวันให้ครบทั้งเดือน
        if (interval === "daily") {
            const map = new Map<string, { income: number; expense: number }>();
            for (const p of items) {
                map.set(p.bucket, { income: num(p.income), expense: num(p.expense) });
            }

            const y = Number(month.slice(0, 4));
            const m = Number(month.slice(5, 7)); // 1..12
            const lastDay = new Date(y, m, 0).getDate();

            const filled: Array<{ label: string; income: number; expense: number }> = [];
            for (let d = 1; d <= lastDay; d++) {
                const day = String(d).padStart(2, "0");
                const key = `${month}-${day}`;

                const v = map.get(key);
                filled.push({
                    label: day, // 01..31
                    income: v ? v.income : 0,
                    expense: v ? v.expense : 0,
                });
            }
            return filled;
        }

        // ✅ weekly: label เป็น W1, W2, ... ตามลำดับของ bucket
        if (interval === "weekly") {
            return items.map((p, idx) => ({
                label: `W${idx + 1}`,
                income: num(p.income),
                expense: num(p.expense),
                // เก็บ bucket ไว้เผื่อ tooltip อยากโชว์วันจริง
                bucket: p.bucket,
            }));
        }

        // ✅ monthly: label เป็นชื่อเดือน (Dec) จาก month ที่เลือก
        const d = new Date(`${month}-01T00:00:00`);
        const monthShort = d.toLocaleString("en-US", { month: "short" }); // "Dec"
        // ถ้าอยากให้ชัดขึ้นใช้ `${monthShort} ${d.getFullYear()}`
        return items.map((p) => ({
            label: monthShort, // "Dec"
            income: num(p.income),
            expense: num(p.expense),
            bucket: p.bucket,
        }));
    }, [trend, month, interval]);

    return (
        <ProtectedLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Reports</h1>
                        <p className="text-sm text-gray-600">
                            Summary • By Category • Trend • currency: {currency}
                        </p>

                        {summary && (
                            <p className="mt-1 text-xs text-gray-500">
                                Range: {summary.from} → {summary.to}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600">Month</label>
                        <input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="rounded-xl border px-3 py-2"
                        />
                        <div className="flex items-center gap-2">
                            {(["daily", "weekly", "monthly"] as const).map((x) => (
                                <button
                                    key={x}
                                    onClick={() => setInterval(x)}
                                    className={[
                                        "rounded-xl border px-3 py-2 text-sm capitalize",
                                        interval === x ? "bg-gray-900 text-white border-gray-900" : "hover:bg-gray-50",
                                    ].join(" ")}
                                >
                                    {x}
                                </button>
                            ))}
                        </div>

                        <button onClick={load} className="rounded-xl border px-4 py-2 hover:bg-gray-50">
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Warnings */}
                {warn.length > 0 && (
                    <div className="rounded-2xl border p-4 bg-amber-50">
                        <div className="font-medium">Heads up</div>
                        <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
                            {warn.map((w, i) => (
                                <li key={i}>{w}</li>
                            ))}
                        </ul>
                        <div className="mt-2 text-xs text-amber-800">
                            เช็คว่า backend routes คือ <code className="px-1">/api/reports/summary/</code>,{" "}
                            <code className="px-1">/api/reports/by-category/</code>,{" "}
                            <code className="px-1">/api/reports/trend/</code> และใช้ query params{" "}
                            <code className="px-1">from</code> / <code className="px-1">to</code>
                        </div>
                    </div>
                )}

                {/* Summary Cards */}
                <section className="grid gap-4 md:grid-cols-4">
                    <Card title="Income" loading={loading} value={summary ? `${summary.income} ${currency}` : "—"} />
                    <Card title="Expense" loading={loading} value={summary ? `${summary.expense} ${currency}` : "—"} />
                    <Card title="Net" loading={loading} value={summary ? `${summary.net} ${currency}` : "—"} />
                    <Card title="Range" loading={loading} value={summary ? `${summary.from} → ${summary.to}` : "—"} />
                </section>

                {/* Charts */}
                <section className="grid gap-4 lg:grid-cols-2">
                    {/* Donut */}
                    <div className="rounded-2xl border p-4">
                        <div className="flex items-center justify-between">
                            <div className="font-medium">Expenses by Category (Donut)</div>
                            <div className="text-sm text-gray-600">{month}</div>
                        </div>

                        <div className="h-80 mt-3">
                            {loading ? (
                                <div className="p-6 text-sm text-gray-600">Loading...</div>
                            ) : pieData.length === 0 ? (
                                <div className="p-6 text-sm text-gray-600">No data.</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} />
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Bar */}
                    <div className="rounded-2xl border p-4">
                        <div className="flex items-center justify-between">
                            <div className="font-medium">Top Categories (Bar)</div>
                            <div className="text-sm text-gray-600">{currency}</div>
                        </div>

                        <div className="h-80 mt-3">
                            {loading ? (
                                <div className="p-6 text-sm text-gray-600">Loading...</div>
                            ) : barData.length === 0 ? (
                                <div className="p-6 text-sm text-gray-600">No data.</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={barData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" hide />
                                        <YAxis />
                                            
                                        <Bar dataKey="amount" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {!loading && barData.length > 0 && (
                            <div className="mt-3 text-xs text-gray-500">
                                * ซ่อน label แกน X เพื่อให้ดูสะอาด
                            </div>
                        )}
                    </div>
                </section>

                {/* Trend */}
                <section className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between">
                        <div className="font-medium">Trend ({interval}) • Income vs Expense</div>
                        <div className="text-sm text-gray-600">{month}</div>
                    </div>

                    <div className="h-80 mt-3">
                        {loading ? (
                            <div className="p-6 text-sm text-gray-600">Loading...</div>
                        ) : trendData.length === 0 ? (
                            <div className="p-6 text-sm text-gray-600">No data.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="label" interval={interval === "daily" ? 2 : 0} />
                                    <YAxis />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="income" />
                                    <Line type="monotone" dataKey="expense" />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {!loading && trend && (
                        <div className="mt-2 text-xs text-gray-500">
                            interval: {trend.interval}
                        </div>
                    )}
                </section>

                {/* Table */}
                <section className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between">
                        <div className="font-medium">Category Breakdown</div>
                        <div className="text-sm text-gray-600">Top 12</div>
                    </div>

                    {loading ? (
                        <div className="p-6 text-sm text-gray-600">Loading...</div>
                    ) : !cat || cat.items.length === 0 ? (
                        <div className="p-6 text-sm text-gray-600">No data.</div>
                    ) : (
                        <div className="mt-3 overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-600">
                                    <tr className="border-b">
                                        <th className="py-2 pr-3">Category</th>
                                        <th className="py-2 pr-3">Total ({currency})</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cat.items.slice(0, 12).map((x) => (
                                        <tr key={`${x.category_id}-${x.category_name}`} className="border-b last:border-b-0">
                                            <td className="py-2 pr-3">{x.category_name || "Uncategorized"}</td>
                                            <td className="py-2 pr-3">{num(x.total).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </ProtectedLayout>
    );
}

function Card({ title, value, loading }: { title: string; value: string; loading: boolean }) {
    return (
        <div className="rounded-2xl border p-4">
            <div className="text-sm text-gray-600">{title}</div>
            <div className="mt-2 text-xl font-semibold">{loading ? "…" : value}</div>
        </div>
    );
}
