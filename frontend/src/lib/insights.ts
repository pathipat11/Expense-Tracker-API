/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "@/lib/api";
import { getReportsByCategory, getReportsSummary, getReportsTrend } from "@/lib/reports";

export type InsightLanguage = "th" | "en";

export type AiMonthlySummaryResponse = {
    month: string;
    language: InsightLanguage;
    base_currency: string;
    text: string;          // สมมติ backend ส่ง text (ถ้าคุณส่งชื่อ field อื่น แก้ตรงนี้)
    source?: "ai" | "fallback";
};

function isLikelyAiKeyError(err: any) {
    const status = err?.response?.status;
    const msg = String(err?.response?.data?.detail || err?.response?.data?.error || err?.message || "").toLowerCase();
    // เผื่อ backend โยนข้อความ invalid_api_key / Incorrect API key / AuthenticationError
    return status === 401 || msg.includes("invalid_api_key") || msg.includes("incorrect api key") || msg.includes("authentication");
}

function fmtMoney(n: number, currency: string) {
    return `${n.toFixed(2)} ${currency}`;
}

function num(x: any) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
}

function monthRange(month: string) {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const from = `${month}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${month}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
}

/** ✅ Fallback สรุปจาก reports (ฟรี) */
export async function generateFallbackMonthlyInsight(month: string, language: InsightLanguage) {
    const { from, to } = monthRange(month);

    // ใช้ APIs ที่คุณมีอยู่แล้ว
    const [summary, byCat, trend] = await Promise.all([
        getReportsSummary(month),                 // backend ของคุณคืน from/to/base_currency/income/expense/net
        getReportsByCategory(month, "expense"),   // items: {category_name,total}
        getReportsTrend(month, "daily"),          // items: {bucket,income,expense}
    ]);

    const currency = summary.base_currency || byCat.base_currency || trend.base_currency || "THB";

    // Top categories
    const items = (byCat.items ?? [])
        .map((x: any) => ({ name: x.category_name || "Uncategorized", total: num(x.total) }))
        .sort((a, b) => b.total - a.total);

    const top3 = items.slice(0, 3);

    // Trend hints: วันใช้จ่ายสูงสุด
    const trendItems = (trend.items ?? []).map((p: any) => ({
        day: String(p.bucket).slice(0, 10),
        income: num(p.income),
        expense: num(p.expense),
    }));
    const maxExpenseDay = trendItems.slice().sort((a, b) => b.expense - a.expense)[0];

    const income = num(summary.income);
    const expense = num(summary.expense);
    const net = num(summary.net);

    // สร้างข้อความตามภาษา
    const lines: string[] = [];

    if (language === "th") {
        lines.push(`สรุปการเงินประจำเดือน ${month}`);
        lines.push(`ช่วงเวลา: ${summary.from ?? from} → ${summary.to ?? to}`);
        lines.push("");
        lines.push(`• รายรับ (Income): ${fmtMoney(income, currency)}`);
        lines.push(`• รายจ่าย (Expense): ${fmtMoney(expense, currency)}`);
        lines.push(`• คงเหลือสุทธิ (Net): ${fmtMoney(net, currency)}`);
        lines.push("");

        if (top3.length) {
            lines.push("Top หมวดรายจ่าย:");
            top3.forEach((t, i) => lines.push(`  ${i + 1}) ${t.name}: ${fmtMoney(t.total, currency)}`));
            lines.push("");
        }

        if (maxExpenseDay && maxExpenseDay.expense > 0) {
            lines.push(`วันที่ใช้จ่ายสูงสุด: ${maxExpenseDay.day} (${fmtMoney(maxExpenseDay.expense, currency)})`);
            lines.push("");
        }

        // คำแนะนำง่าย ๆ
        if (expense > income && income > 0) {
            lines.push("ข้อสังเกต: รายจ่ายมากกว่ารายรับ ลองตั้งงบ (Budgets) และลดหมวด Top 1 ลงเล็กน้อยครับ");
        } else if (expense === 0) {
            lines.push("ข้อสังเกต: เดือนนี้ยังไม่มีรายจ่าย ลองเพิ่ม Transaction เพื่อให้เห็นรายงานชัดขึ้นครับ");
        } else {
            lines.push("ข้อสังเกต: ภาพรวมดูโอเค ลองติดตาม Trend รายวันและปรับ Budgets ให้เหมาะสมครับ");
        }
    } else {
        lines.push(`Monthly Finance Summary — ${month}`);
        lines.push(`Range: ${summary.from ?? from} → ${summary.to ?? to}`);
        lines.push("");
        lines.push(`• Income: ${fmtMoney(income, currency)}`);
        lines.push(`• Expense: ${fmtMoney(expense, currency)}`);
        lines.push(`• Net: ${fmtMoney(net, currency)}`);
        lines.push("");

        if (top3.length) {
            lines.push("Top expense categories:");
            top3.forEach((t, i) => lines.push(`  ${i + 1}) ${t.name}: ${fmtMoney(t.total, currency)}`));
            lines.push("");
        }

        if (maxExpenseDay && maxExpenseDay.expense > 0) {
            lines.push(`Highest spending day: ${maxExpenseDay.day} (${fmtMoney(maxExpenseDay.expense, currency)})`);
            lines.push("");
        }

        if (expense > income && income > 0) {
            lines.push("Insight: Expenses exceed income — consider setting budgets and cutting the top category slightly.");
        } else if (expense === 0) {
            lines.push("Insight: No expenses this month — add transactions to get meaningful analytics.");
        } else {
            lines.push("Insight: Looks healthy — keep tracking daily trend and refine budgets.");
        }
    }

    return {
        month,
        language,
        base_currency: currency,
        text: lines.join("\n"),
        source: "fallback" as const,
    };
}

/** ✅ พยายามใช้ AI ก่อน ถ้าเจ๊ง → fallback อัตโนมัติ */
export async function getMonthlyInsightAuto(month: string, language: InsightLanguage) {
    try {
        const res = await api.post("/api/ai/monthly-summary/", { month, language });
        // ปรับ mapping ให้ตรงกับ backend ของคุณ
        const data = res.data;

        const text = data.text ?? data.insight ?? data.summary ?? "";
        return {
            month: data.month ?? month,
            language: data.language ?? language,
            base_currency: data.base_currency ?? data.currency ?? "THB",
            text,
            source: "ai" as const,
        };
    } catch (err: any) {
        // ถ้าเป็น key error หรือ server error -> fallback
        if (isLikelyAiKeyError(err) || err?.response?.status >= 500) {
            return await generateFallbackMonthlyInsight(month, language);
        }
        // error อื่น ๆ ก็ fallback ได้เหมือนกัน (กันหน้าใช้งานไม่ได้)
        return await generateFallbackMonthlyInsight(month, language);
    }
}
