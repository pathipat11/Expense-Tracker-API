import { api } from "@/lib/api";

export type Transaction = {
    id: number;
    type: "expense" | "income" | "transfer_out" | "transfer_in";
    occurred_at: string;
    amount: string;
    merchant: string;
    note: string;
    receipt_url: string;
    base_amount: string;
    fx_rate: string;
    currency?: { id: number; code: string; name?: string };
    wallet?: { id: number; name: string };
    category?: { id: number; name: string; type: string };
};

export async function listTransactions(params?: { type?: string; wallet?: number; category?: number }) {
    const res = await api.get("/api/transactions/", { params });
    return res.data as Transaction[];
}

export async function createTransaction(payload: {
    type: "expense" | "income";
    occurred_at: string;
    amount: string;
    wallet_id: number;
    category_id?: number | null;
    merchant?: string;
    note?: string;
}) {
    const res = await api.post("/api/transactions/", payload);
    return res.data as Transaction;
}

export async function patchTransaction(id: number, payload: Partial<{ receipt_url: string; merchant: string; note: string }>) {
    const res = await api.patch(`/api/transactions/${id}/`, payload);
    return res.data as Transaction;
}

export async function uploadReceipt(file: File) {
    const form = new FormData();
    form.append("file", file);

    const res = await api.post("/api/receipts/upload/", form, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data as { id: number; receipt_url: string };
}
