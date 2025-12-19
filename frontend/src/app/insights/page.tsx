/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import { getMonthlyInsightAuto, InsightLanguage } from "@/lib/insights";

function yyyyMmNow() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

export default function InsightsPage() {
    const [month, setMonth] = useState(yyyyMmNow());
    const [language, setLanguage] = useState<InsightLanguage>("th");

    const [loading, setLoading] = useState(false);
    const [source, setSource] = useState<"ai" | "fallback" | null>(null);
    const [text, setText] = useState<string>("");
    const [error, setError] = useState<string>("");

    const badge = useMemo(() => {
        if (!source) return null;
        return source === "ai"
            ? { label: "AI", cls: "bg-emerald-600 text-white" }
            : { label: "Fallback (Free)", cls: "bg-gray-900 text-white" };
    }, [source]);

    async function generate() {
        setLoading(true);
        setError("");
        try {
            const res = await getMonthlyInsightAuto(month, language);
            setText(res.text || "");
            setSource(res.source);
        } catch (e: any) {
            setError("Failed to generate insight.");
            setSource(null);
            setText("");
        } finally {
            setLoading(false);
        }
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(text || "");
        } catch {
            // ignore
        }
    }

    return (
        <ProtectedLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Insights (AI)</h1>
                        <p className="text-sm text-gray-600">
                            Generate monthly insight. Auto fallback if AI key is missing.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <label className="text-sm text-gray-600">Month</label>
                        <input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="rounded-xl border px-3 py-2"
                        />

                        <label className="text-sm text-gray-600">Language</label>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value as InsightLanguage)}
                            className="rounded-xl border px-3 py-2"
                        >
                            <option value="th">ไทย</option>
                            <option value="en">English</option>
                        </select>

                        <button
                            onClick={generate}
                            disabled={loading}
                            className="rounded-xl border px-4 py-2 hover:bg-gray-50 disabled:opacity-60"
                        >
                            {loading ? "Generating..." : "Generate"}
                        </button>
                    </div>
                </div>

                {/* Result */}
                <div className="rounded-2xl border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <div className="font-medium">Monthly Insight</div>
                            {badge && (
                                <span className={`text-xs px-2 py-1 rounded-full ${badge.cls}`}>
                                    {badge.label}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={copy}
                                disabled={!text}
                                className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
                            >
                                Copy
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="mt-3 rounded-xl border bg-rose-50 p-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="mt-4">
                        {!text ? (
                            <div className="text-sm text-gray-600">
                                Click <b>Generate</b> to create your monthly insight.
                            </div>
                        ) : (
                            <pre className="whitespace-pre-wrap text-sm leading-6">
                                {text}
                            </pre>
                        )}
                    </div>

                    <div className="mt-3 text-xs text-gray-500">
                        * If OpenAI key is missing/invalid, the app automatically falls back to a free rule-based summary from Reports.
                    </div>
                </div>
            </div>
        </ProtectedLayout>
    );
}
