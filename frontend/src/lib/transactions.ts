/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "@/lib/api";

export type Paginated<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

export type Transaction = {
    id: number;
    type: "expense" | "income" | "transfer_out" | "transfer_in";
    occurred_at: string;
    amount: string;

    merchant: string;
    note: string;

    receipt_url: string | null;
    receipt_abs_url?: string | null;

    base_amount: string;
    fx_rate: string;

    wallet?: { id: number; name: string };
    currency?: { code: string };
    category?: { id: number; name: string; type: string } | null;
};

export type CreateTxPayload = {
    type: "expense" | "income";
    occurred_at: string; // ISO
    amount: string;
    wallet_id: number;
    category_id?: number | null;
    merchant?: string;
    note?: string;
    receipt_url?: string | null;
};

function normalizePaginated<T>(data: any): Paginated<T> {
    // ✅ backend paginate แล้ว
    if (data && typeof data === "object" && Array.isArray(data.results)) {
        return {
            count: Number(data.count ?? data.results.length ?? 0),
            next: data.next ?? null,
            previous: data.previous ?? null,
            results: data.results as T[],
        };
    }

    // ✅ backend ยังส่ง array ตรงๆ
    if (Array.isArray(data)) {
        return { count: data.length, next: null, previous: null, results: data as T[] };
    }

    // ✅ กันพังไว้ก่อน
    return { count: 0, next: null, previous: null, results: [] as T[] };
}

export async function listTransactions(params?: any) {
    const res = await api.get("/api/transactions/", { params });
    return normalizePaginated<Transaction>(res.data);
}

export async function getTransaction(id: number) {
    const res = await api.get(`/api/transactions/${id}/`);
    return res.data as Transaction;
}

export async function patchTransaction(
    id: number,
    payload: Partial<{
        occurred_at: string;
        amount: string;
        wallet_id: number;
        category_id: number | null;
        merchant: string;
        note: string;
        receipt_url: string | null;
    }>
) {
    // ✅ ถ้า backend ไม่รับ null สำหรับ receipt_url ให้ส่ง "" แทน
    const safePayload = { ...payload } as any;
    if ("receipt_url" in safePayload && safePayload.receipt_url === null) {
        safePayload.receipt_url = "";
    }

    const res = await api.patch(`/api/transactions/${id}/`, safePayload);
    return res.data as Transaction;
}

export async function deleteTransaction(id: number) {
    await api.delete(`/api/transactions/${id}/`);
}

export async function uploadReceipt(file: File) {
    const form = new FormData();
    form.append("file", file);

    const res = await api.post("/api/receipts/upload/", form, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    const data = res.data;
    return {
        id: data.id,
        receipt_url: data.file_url ?? data.receipt_url ?? data.image_url ?? data.url ?? data.file,
    } as { id: number; receipt_url: string };
}


export async function createTransaction(payload: CreateTxPayload) {
    const res = await api.post("/api/transactions/", payload);
    return res.data as Transaction;
}
