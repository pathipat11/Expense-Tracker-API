/* eslint-disable @typescript-eslint/no-unused-vars */
import { api } from "@/lib/api";

// ---------- helpers ----------
function monthToRange(month: string) {
    // month: "YYYY-MM"
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7)); // 1..12
    const from = `${month}-01`;

    const lastDay = new Date(y, m, 0).getDate(); // JS: day 0 = last day of prev month => month m gives last day of that month
    const to = `${month}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
}

function n(x: string | number) {
    const v = typeof x === "number" ? x : Number(x);
    return Number.isFinite(v) ? v : 0;
}

// ---------- types (match your backend) ----------
export type ReportsSummary = {
    from: string;
    to: string;
    base_currency: string;
    income: string;
    expense: string;
    net: string;
};

export type ReportsCategoryItem = {
    category_id: number | null;
    category_name: string;
    total: string;
};

export type ReportsByCategoryResponse = {
    from: string;
    to: string;
    type: "expense" | "income";
    base_currency: string;
    items: ReportsCategoryItem[];
};

export type ReportsTrendItem = {
    bucket: string; // YYYY-MM-DD
    income: string;
    expense: string;
};

export type ReportsTrendResponse = {
    from: string;
    to: string;
    interval: "daily" | "weekly" | "monthly";
    base_currency: string;
    items: ReportsTrendItem[];
};



// ---------- API calls ----------
export async function getReportsSummary(month: string) {
    const { from, to } = monthToRange(month);
    const res = await api.get("/api/reports/summary/", { params: { from, to } });
    return res.data as ReportsSummary;
}

export async function getReportsByCategory(month: string, type: "expense" | "income" = "expense") {
    const { from, to } = monthToRange(month);
    const res = await api.get("/api/reports/by-category/", { params: { from, to, type } });
    return res.data as ReportsByCategoryResponse;
}

export async function getReportsTrend(
    month: string,
    interval: "daily" | "weekly" | "monthly" = "daily",
    type: "expense" | "income" | "all" = "all"
) {
    const { from, to } = monthToRange(month);
    const res = await api.get("/api/reports/trend/", { params: { from, to, interval, type } });
    return res.data as ReportsTrendResponse;
}
