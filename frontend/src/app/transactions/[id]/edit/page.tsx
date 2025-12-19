// src/app/transactions/[id]/edit/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import TransactionForm, { TxFormValues } from "@/components/TransactionForm";
import { deleteTransaction, getTransaction, patchTransaction, Transaction } from "@/lib/transactions";

export default function EditTransactionPage() {
    const router = useRouter();
    const params = useParams();
    const id = Number(params?.id);

    const [tx, setTx] = useState<Transaction | null>(null);
    const [loading, setLoading] = useState(true);

    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const t = await getTransaction(id);
                setTx(t);
            } catch (e: any) {
                setErr(e?.response?.data?.detail || "Failed to load transaction");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const initial = useMemo(() => {
        if (!tx) return undefined;
        return {
            type: (tx.type === "income" ? "income" : "expense") as "income" | "expense", // ถ้าเป็น transfer จะ map ให้เป็น expense เพื่อไม่พัง UI
            occurred_at_iso: tx.occurred_at,
            wallet_id: tx.wallet?.id ?? null,
            category_id: tx.category?.id ?? null,
            amount: tx.amount,
            merchant: tx.merchant ?? "",
            note: tx.note ?? "",
            receipt_url: tx.receipt_abs_url ?? tx.receipt_url ?? null,
        };
    }, [tx]);

    async function onSubmit(values: TxFormValues) {
        setBusy(true);
        setErr(null);
        try {
            const updated = await patchTransaction(id, {
                // type: values.type, // แนะนำ: ถ้าอยากให้แก้ type ได้ เปิดบรรทัดนี้
                occurred_at: values.occurred_at,
                amount: values.amount,
                wallet_id: values.wallet_id!,
                category_id: values.category_id ?? null,
                merchant: values.merchant,
                note: values.note,
                receipt_url: values.receipt_url ?? null,
            });
            setTx(updated);
            router.push("/transactions");
        } catch (e: any) {
            setErr(e?.response?.data?.detail || "Update failed");
        } finally {
            setBusy(false);
        }
    }

    async function onDelete() {
        if (!confirm("Delete this transaction?")) return;
        setBusy(true);
        setErr(null);
        try {
            await deleteTransaction(id);
            router.push("/transactions");
        } catch (e: any) {
            setErr(e?.response?.data?.detail || "Delete failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <ProtectedLayout>
            <div className="max-w-3xl space-y-6">
                <div className="flex items-end justify-between gap-2">
                    <div>
                        <h1 className="text-2xl font-semibold">Edit Transaction</h1>
                        <p className="text-sm text-gray-600">Update / Delete ✅</p>
                    </div>
                    <button onClick={() => router.back()} className="rounded-xl border px-4 py-2 hover:bg-gray-50">
                        Back
                    </button>
                </div>

                {loading ? (
                    <div className="rounded-xl border p-6">Loading...</div>
                ) : !tx || !initial ? (
                    <div className="rounded-xl border p-6">Not found.</div>
                ) : (
                    <TransactionForm
                        mode="edit"
                        submitLabel="Save changes"
                        busy={busy}
                        error={err}
                        initial={initial}
                        onSubmit={onSubmit}
                        onDelete={onDelete}
                    />
                )}
            </div>
        </ProtectedLayout>
    );
}
