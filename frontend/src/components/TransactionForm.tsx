// src/components/TransactionForm.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { uploadReceipt } from "@/lib/transactions";
import { listWallets, Wallet } from "@/lib/wallets";
import { listCategories, Category } from "@/lib/categories";

type TxType = "expense" | "income";

export type TxFormValues = {
    type: TxType;
    occurred_at: string; // datetime-local value: YYYY-MM-DDTHH:mm
    wallet_id: number | null;
    category_id: number | null;
    amount: string;
    merchant: string;
    note: string;
    receipt_url: string | null;
};

function toLocalInputValue(iso: string) {
    // ISO -> "YYYY-MM-DDTHH:mm"
    try {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
            d.getMinutes()
        )}`;
    } catch {
        return iso.slice(0, 16);
    }
}

function nowLocalInputValue() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
        d.getMinutes()
    )}`;
}

function isImage(file: File) {
    return file.type.startsWith("image/");
}

export default function TransactionForm({
    mode,
    initial,
    submitLabel,
    busy,
    error,
    onSubmit,
    onDelete,
}: {
    mode: "create" | "edit";
    initial?: Partial<TxFormValues> & { occurred_at_iso?: string };
    submitLabel: string;
    busy: boolean;
    error: string | null;
    onSubmit: (values: TxFormValues) => Promise<void>;
    onDelete?: () => Promise<void>;
}) {
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    // --- form state ---
    const [type, setType] = useState<TxType>(initial?.type ?? "expense");
    const [occurredAt, setOccurredAt] = useState<string>(() => {
        if (initial?.occurred_at) return initial.occurred_at;
        if (initial?.occurred_at_iso) return toLocalInputValue(initial.occurred_at_iso);
        return nowLocalInputValue();
    });

    const [walletId, setWalletId] = useState<number | null>(initial?.wallet_id ?? null);
    const [categoryId, setCategoryId] = useState<number | null>(initial?.category_id ?? null);
    const [amount, setAmount] = useState<string>(initial?.amount ?? "");
    const [merchant, setMerchant] = useState<string>(initial?.merchant ?? "");
    const [note, setNote] = useState<string>(initial?.note ?? "");
    const [receiptUrl, setReceiptUrl] = useState<string | null>(initial?.receipt_url ?? null);

    // upload state
    const [uploading, setUploading] = useState(false);
    const [uploadErr, setUploadErr] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const [ws, cs] = await Promise.all([listWallets(), listCategories()]);
            setWallets(ws);
            setCategories(cs);

            // default wallet if none
            if (!walletId && ws.length > 0) setWalletId(ws[0].id);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const categoriesForType = useMemo(() => {
        return categories.filter((c) => c.type === type);
    }, [categories, type]);

    // when type changes, if selected category not match -> clear
    useEffect(() => {
        if (!categoryId) return;
        const ok = categoriesForType.some((c) => c.id === categoryId);
        if (!ok) setCategoryId(null);
    }, [type, categoriesForType, categoryId]);

    async function onUploadReceipt(file: File) {
        setUploadErr(null);
        if (!isImage(file)) {
            setUploadErr("Please select an image file.");
            return;
        }
        setUploading(true);
        try {
            const r = await uploadReceipt(file);
            setReceiptUrl(r.receipt_url);
        } catch (e: any) {
            setUploadErr(e?.response?.data?.detail || "Upload failed");
        } finally {
            setUploading(false);
        }
    }

    async function submit() {
        if (!walletId) return;
        if (!amount || Number(amount) <= 0) return;

        const iso = new Date(occurredAt).toISOString(); // backend expects occurred_at as ISO
        await onSubmit({
            type,
            occurred_at: iso,
            wallet_id: walletId,
            category_id: categoryId,
            amount,
            merchant,
            note,
            receipt_url: receiptUrl,
        });
    }

    const amountInvalid = !amount || Number(amount) <= 0;

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-xl border bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
            )}

            <div className="grid gap-4">
                {/* type */}
                <div className="flex gap-2">
                    {(["expense", "income"] as const).map((x) => (
                        <button
                            key={x}
                            type="button"
                            onClick={() => setType(x)}
                            className={[
                                "rounded-xl border px-4 py-2 capitalize",
                                type === x ? "bg-gray-900 text-white border-gray-900" : "hover:bg-gray-50",
                            ].join(" ")}
                        >
                            {x}
                        </button>
                    ))}
                    {mode === "edit" && (
                        <div className="text-xs text-gray-500 self-center">
                            * transfer types should be edited via transfer flow (optional)
                        </div>
                    )}
                </div>

                {/* occurred_at */}
                <div className="grid gap-1">
                    <label className="text-xs text-gray-600">Date & time</label>
                    <input
                        type="datetime-local"
                        value={occurredAt}
                        onChange={(e) => setOccurredAt(e.target.value)}
                        className="rounded-xl border px-3 py-2"
                    />
                </div>

                {/* wallet */}
                <div className="grid gap-1">
                    <label className="text-xs text-gray-600">Wallet</label>
                    <select
                        value={walletId ?? ""}
                        onChange={(e) => setWalletId(e.target.value ? Number(e.target.value) : null)}
                        className="rounded-xl border px-3 py-2"
                    >
                        <option value="">Select wallet</option>
                        {wallets.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* category */}
                <div className="grid gap-1">
                    <label className="text-xs text-gray-600">Category</label>
                    <select
                        value={categoryId ?? ""}
                        onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                        className="rounded-xl border px-3 py-2"
                    >
                        <option value="">No category</option>
                        {categoriesForType.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* amount */}
                <div className="grid gap-1">
                    <label className="text-xs text-gray-600">Amount</label>
                    <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="rounded-xl border px-3 py-2"
                    />
                    {amountInvalid && <div className="text-xs text-rose-600">Amount must be greater than 0.</div>}
                </div>

                {/* merchant */}
                <div className="grid gap-1">
                    <label className="text-xs text-gray-600">Merchant</label>
                    <input
                        placeholder="(optional)"
                        value={merchant}
                        onChange={(e) => setMerchant(e.target.value)}
                        className="rounded-xl border px-3 py-2"
                    />
                </div>

                {/* note */}
                <div className="grid gap-1">
                    <label className="text-xs text-gray-600">Note</label>
                    <textarea
                        placeholder="(optional)"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="rounded-xl border px-3 py-2"
                    />
                </div>

                {/* receipt */}
                <div className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">Receipt</div>
                        {receiptUrl && (
                            <a className="text-sm underline" href={receiptUrl} target="_blank" rel="noreferrer">
                                Open
                            </a>
                        )}
                    </div>

                    {uploadErr && <div className="text-sm text-rose-700">{uploadErr}</div>}

                    {receiptUrl ? (
                        <div className="space-y-2">
                            <img src={receiptUrl} alt="receipt" className="max-h-72 rounded-lg border bg-white object-contain" />
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setReceiptUrl(null)}
                                    className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                                >
                                    Remove receipt
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigator.clipboard?.writeText(receiptUrl)}
                                    className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                                >
                                    Copy URL
                                </button>
                            </div>
                        </div>
                    ) : (
                        <label className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer hover:bg-gray-50">
                            <span className="text-sm">{uploading ? "Uploading..." : "Upload receipt"}</span>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploading}
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    onUploadReceipt(f);
                                    e.currentTarget.value = "";
                                }}
                            />
                        </label>
                    )}

                    {/* allow paste url */}
                    <div className="grid gap-1">
                        <label className="text-xs text-gray-600">Or paste URL</label>
                        <input
                            value={receiptUrl ?? ""}
                            onChange={(e) => setReceiptUrl(e.target.value || null)}
                            placeholder="https://..."
                            className="rounded-xl border px-3 py-2"
                        />
                    </div>
                </div>

                {/* actions */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={submit}
                        disabled={busy || !walletId || amountInvalid}
                        className="rounded-xl border px-6 py-3 font-medium hover:bg-gray-50 disabled:opacity-60"
                    >
                        {busy ? "Saving..." : submitLabel}
                    </button>

                    {onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            disabled={busy}
                            className="rounded-xl border px-4 py-3 text-sm hover:bg-rose-50 disabled:opacity-60"
                        >
                            Delete
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
