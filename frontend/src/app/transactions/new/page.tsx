// src/app/transactions/new/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import TransactionForm, { TxFormValues } from "@/components/TransactionForm";
import { createTransaction } from "@/lib/transactions";

function safeDecode(s: string) {
    try {
        return decodeURIComponent(s);
    } catch {
        return s;
    }
}

export default function NewTransactionPage() {
    const router = useRouter();
    const sp = useSearchParams();

    const initialReceiptUrl = useMemo(() => {
        const u = sp.get("receipt_url");
        return u ? safeDecode(u) : null;
    }, [sp]);

    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function onSubmit(values: TxFormValues) {
        setBusy(true);
        setErr(null);
        try {
            await createTransaction({
                type: values.type,
                occurred_at: values.occurred_at,
                amount: values.amount,
                wallet_id: values.wallet_id!,
                category_id: values.category_id ?? null,
                merchant: values.merchant,
                note: values.note,
                receipt_url: values.receipt_url ?? null,
            });
            router.push("/transactions");
        } catch (e: any) {
            setErr(e?.response?.data?.detail || "Create failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <ProtectedLayout>
            <div className="max-w-3xl space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold">Create Transaction</h1>
                    <p className="text-sm text-gray-600">
                        Expense/Income only • receipt auto-fill supported ✅
                    </p>
                </div>

                <TransactionForm
                    mode="create"
                    submitLabel="Create"
                    busy={busy}
                    error={err}
                    initial={{
                        receipt_url: initialReceiptUrl,
                    }}
                    onSubmit={onSubmit}
                />
            </div>
        </ProtectedLayout>
    );
}
