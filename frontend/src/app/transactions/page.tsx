"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedLayout from "@/components/ProtectedLayout"
import {
    listTransactions,
    uploadReceipt,
    patchTransaction,
    Transaction,
} from "@/lib/transactions";

export default function TransactionsPage() {
    const [items, setItems] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        setErr(null);
        try {
            const data = await listTransactions();
            setItems(data);
        } catch {
            setErr("Failed to load transactions");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function onUploadReceipt(txId: number, file: File) {
        try {
            const { receipt_url } = await uploadReceipt(file);
            const updated = await patchTransaction(txId, { receipt_url });
            setItems((prev) => prev.map((x) => (x.id === txId ? updated : x)));
        } catch {
            alert("Upload failed");
        }
    }

    return (
        <ProtectedLayout>
            <div className="p-6 space-y-4">
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Transactions</h1>
                        <p className="text-sm text-gray-600">Upload receipt → auto patch transaction ✅</p>
                    </div>
                    <button onClick={load} className="rounded-xl border px-4 py-2 hover:bg-gray-50">
                        Refresh
                    </button>
                </div>

                {err && <div className="rounded-xl border p-3 text-red-600">{err}</div>}

                {loading ? (
                    <div className="rounded-xl border p-6">Loading...</div>
                ) : items.length === 0 ? (
                    <div className="rounded-xl border p-6">No transactions yet.</div>
                ) : (
                    <div className="space-y-3">
                        {items.map((tx) => (
                            <TransactionCard key={tx.id} tx={tx} onUploadReceipt={onUploadReceipt} />
                        ))}
                    </div>
                )}
            </div>
        </ProtectedLayout>
    );
}

function TransactionCard({
    tx,
    onUploadReceipt,
}: {
    tx: Transaction;
    onUploadReceipt: (txId: number, file: File) => Promise<void>;
}) {
    const date = useMemo(() => {
        try {
            return new Date(tx.occurred_at).toLocaleString();
        } catch {
            return tx.occurred_at;
        }
    }, [tx.occurred_at]);

    return (
        <div className="rounded-2xl border p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="font-medium">
                        {tx.type.toUpperCase()} • {tx.merchant || "—"}
                    </div>
                    <div className="text-sm text-gray-600">
                        {date} • Wallet: {tx.wallet?.name || "—"} • Amount: {tx.amount} {tx.currency?.code || ""}
                    </div>
                    {tx.note && <div className="text-sm text-gray-700 mt-1">{tx.note}</div>}
                </div>

                <div className="text-right">
                    <div className="text-sm text-gray-600">Base</div>
                    <div className="font-semibold">{tx.base_amount}</div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer hover:bg-gray-50">
                    <span className="text-sm">Upload receipt</span>
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            onUploadReceipt(tx.id, f);
                            e.currentTarget.value = ""; // reset
                        }}
                    />
                </label>

                {tx.receipt_url ? (
                    <a
                        className="text-sm underline text-blue-600"
                        href={tx.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                    >
                        View receipt
                    </a>
                ) : (
                    <span className="text-sm text-gray-500">No receipt</span>
                )}
            </div>
        </div>
    );
}
