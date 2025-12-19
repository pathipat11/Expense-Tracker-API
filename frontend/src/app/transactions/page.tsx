/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
    listTransactions,
    uploadReceipt,
    patchTransaction,
    Transaction,
    Paginated,
} from "@/lib/transactions";

import { listWallets, Wallet } from "@/lib/wallets";
import { listCategories, Category } from "@/lib/categories";

function isImage(file: File) {
    return file.type.startsWith("image/");
}

function safeDecode(s: string) {
    try {
        return decodeURIComponent(s);
    } catch {
        return s;
    }
}

function fmtDateTime(s: string) {
    try {
        return new Date(s).toLocaleString();
    } catch {
        return s;
    }
}

function yyyyMmNow() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

function monthToRangeStrings(month: string) {
    // month = YYYY-MM
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7)); // 1..12
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0);

    const f = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(
        from.getDate()
    ).padStart(2, "0")}`;

    const t = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(
        to.getDate()
    ).padStart(2, "0")}`;

    return { from: f, to: t };
}

export default function TransactionsPage() {
    const router = useRouter();
    const sp = useSearchParams();

    // ✅ Attach mode: /transactions?receipt_id=xx&receipt_url=...
    const pendingReceipt = useMemo(() => {
        const rid = sp.get("receipt_id");
        const url = sp.get("receipt_url");
        if (!url) return null;
        return {
            receipt_id: rid ? Number(rid) : null,
            receipt_url: safeDecode(url),
        };
    }, [sp]);

    // ----- Filters from URL (with defaults) -----
    const qMonth = sp.get("month") || yyyyMmNow();
    const qType =
        (sp.get("type") as "all" | "expense" | "income" | "transfer_in" | "transfer_out") || "all";
    const qWallet = sp.get("wallet") || "all";
    const qCategory = sp.get("category") || "all";
    const qPage = Number(sp.get("page") || "1");
    const qSize = Number(sp.get("size") || "10");

    const [month, setMonth] = useState(qMonth);
    const [type, setType] = useState<typeof qType>(qType);
    const [wallet, setWallet] = useState<string>(qWallet);
    const [category, setCategory] = useState<string>(qCategory);
    const [page, setPage] = useState<number>(Number.isFinite(qPage) && qPage > 0 ? qPage : 1);
    const [size, setSize] = useState<number>([5, 10, 20, 50].includes(qSize) ? qSize : 10);


    // ----- Data -----
    const [data, setData] = useState<Paginated<Transaction>>({
        count: 0,
        next: null,
        previous: null,
        results: [],
    });

    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);


    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [attachingId, setAttachingId] = useState<number | null>(null);
    const [uploadingId, setUploadingId] = useState<number | null>(null);

    function pushQuery(next: Record<string, string>) {
        const base = new URLSearchParams(sp.toString());

        for (const [k, v] of Object.entries(next)) {
            if (v === "" || v === "all") base.delete(k);
            else base.set(k, v);
        }

        if (!base.get("month")) base.set("month", month);

        router.replace(`/transactions?${base.toString()}`);
    }

    // sync local state with URL on nav
    useEffect(() => {
        setMonth(qMonth);
        setType(qType);
        setWallet(qWallet);
        setCategory(qCategory);
        setPage(Number.isFinite(qPage) && qPage > 0 ? qPage : 1);
        setSize([5, 10, 20, 50].includes(qSize) ? qSize : 10);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sp]);

    async function loadStatic() {
        try {
            const [ws, cs] = await Promise.all([listWallets(), listCategories()]);
            setWallets(Array.isArray(ws) ? ws : []);
            setCategories(Array.isArray(cs) ? cs : []);
        } catch {
            // ignore (ไม่ critical)
        }
    }

    async function loadTransactions() {
        setLoading(true);
        setErr(null);

        try {
            const { from, to } = monthToRangeStrings(month);

            const params: any = {
                from,
                to,
                page,
                page_size: size,
            };

            if (type !== "all") params.type = type;
            if (wallet !== "all") params.wallet = Number(wallet);
            if (category !== "all") params.category = Number(category);

            const res = await listTransactions(params);
            setData(res);
        } catch (e: any) {
            setErr(e?.response?.data?.detail || "Failed to load transactions");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadStatic();
    }, []);

    // ✅ reload whenever filters/pagination change
    useEffect(() => {
        loadTransactions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, type, wallet, category, page, size]);

    const totalPages = Math.max(1, Math.ceil((data.count || 0) / size));

    async function onUploadReceipt(txId: number, file: File) {
        try {
            if (!isImage(file)) {
                alert("Please select an image file.");
                return;
            }
            setUploadingId(txId);

            const { receipt_url } = await uploadReceipt(file);
            const updated = await patchTransaction(txId, { receipt_url });

            // update current page list only
            setData((prev) => ({
                ...prev,
                results: prev.results.map((x) => (x.id === txId ? updated : x)),
            }));
        } catch (e: any) {
            alert(e?.response?.data?.detail || "Upload failed");
        } finally {
            setUploadingId(null);
        }
    }

    async function onAttachPending(txId: number) {
        if (!pendingReceipt?.receipt_url) return;

        setAttachingId(txId);
        try {
            const updated = await patchTransaction(txId, { receipt_url: pendingReceipt.receipt_url });

            setData((prev) => ({
                ...prev,
                results: prev.results.map((x) => (x.id === txId ? updated : x)),
            }));

            // ✅ clear only receipt_id/receipt_url (keep filters)
            const base = new URLSearchParams(sp.toString());
            base.delete("receipt_id");
            base.delete("receipt_url");
            router.replace(`/transactions?${base.toString()}`);
        } catch (e: any) {
            alert(e?.response?.data?.detail || "Attach failed");
        } finally {
            setAttachingId(null);
        }
    }

    function clearPending() {
        const base = new URLSearchParams(sp.toString());
        base.delete("receipt_id");
        base.delete("receipt_url");
        router.replace(`/transactions?${base.toString()}`);
    }

    const categoriesForType = useMemo(() => {
        if (type === "income" || type === "expense") {
            return categories.filter((c) => c.type === type);
        }
        return categories;
    }, [categories, type]);

    const { from: rangeFrom, to: rangeTo } = useMemo(() => monthToRangeStrings(month), [month]);

    return (
        <ProtectedLayout>
            <div className="space-y-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Transactions</h1>
                        <p className="text-sm text-gray-600">
                            Server-side filters + pagination ✅ {pendingReceipt ? "• Attach mode" : ""}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            href={
                                pendingReceipt
                                    ? `/transactions/new?receipt_url=${encodeURIComponent(pendingReceipt.receipt_url)}`
                                    : "/transactions/new"
                            }
                            className="rounded-xl border px-4 py-2 hover:bg-gray-50"
                        >
                            + New
                        </Link>

                        <button
                            onClick={loadTransactions}
                            className="rounded-xl border px-4 py-2 hover:bg-gray-50"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="rounded-2xl border p-4">
                    <div className="flex flex-wrap gap-3">
                        {/* Month */}
                        <div className="min-w-45 flex-1">
                            <label className="text-xs text-gray-600">Month</label>
                            <input
                                type="month"
                                value={month}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setMonth(v);
                                    setPage(1);
                                    pushQuery({ month: v, page: "1" });
                                }}
                                className="mt-1 w-full rounded-xl border px-3 py-2"
                            />
                        </div>

                        {/* Type */}
                        <div className="min-w-45 flex-1">
                            <label className="text-xs text-gray-600">Type</label>
                            <select
                                value={type}
                                onChange={(e) => {
                                    const v = e.target.value as any;
                                    setType(v);
                                    setCategory("all");
                                    setPage(1);
                                    pushQuery({ type: v, category: "all", page: "1" });
                                }}
                                className="mt-1 w-full rounded-xl border px-3 py-2"
                            >
                                <option value="all">All</option>
                                <option value="expense">Expense</option>
                                <option value="income">Income</option>
                                <option value="transfer_in">Transfer In</option>
                                <option value="transfer_out">Transfer Out</option>
                            </select>
                        </div>

                        {/* Wallet */}
                        <div className="min-w-55 flex-1">
                            <label className="text-xs text-gray-600">Wallet</label>
                            <select
                                value={wallet}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setWallet(v);
                                    setPage(1);
                                    pushQuery({ wallet: v, page: "1" });
                                }}
                                className="mt-1 w-full rounded-xl border px-3 py-2"
                            >
                                <option value="all">All wallets</option>
                                {wallets.map((w) => (
                                    <option key={w.id} value={String(w.id)}>
                                        {w.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Category */}
                        <div className="min-w-55 flex-1">
                            <label className="text-xs text-gray-600">Category</label>
                            <select
                                value={category}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setCategory(v);
                                    setPage(1);
                                    pushQuery({ category: v, page: "1" });
                                }}
                                className="mt-1 w-full rounded-xl border px-3 py-2"
                            >
                                <option value="all">All categories</option>
                                {categoriesForType.map((c) => (
                                    <option key={c.id} value={String(c.id)}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Page size */}
                        <div className="min-w-35">
                            <label className="text-xs text-gray-600">Page size</label>
                            <select
                                value={String(size)}
                                onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setSize(v);
                                    setPage(1);
                                    pushQuery({ size: String(v), page: "1" });
                                }}
                                className="mt-1 w-full rounded-xl border px-3 py-2"
                            >
                                {[5, 10, 20, 50].map((n) => (
                                    <option key={n} value={String(n)}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* footer row */}
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-gray-600">
                            Range: <span className="font-medium">{rangeFrom}</span> →{" "}
                            <span className="font-medium">{rangeTo}</span> • Total:{" "}
                            <span className="font-medium">{data.count}</span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => {
                                    const m = yyyyMmNow();
                                    setMonth(m);
                                    setType("all");
                                    setWallet("all");
                                    setCategory("all");
                                    setPage(1);
                                    setSize(10);
                                    pushQuery({
                                        month: m,
                                        type: "all",
                                        wallet: "all",
                                        category: "all",
                                        page: "1",
                                        size: "10",
                                    });
                                }}
                                className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                            >
                                Reset filters
                            </button>

                            <button
                                onClick={loadTransactions}
                                className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                            >
                                Apply / Refresh
                            </button>
                        </div>
                    </div>
                </div>

                {/* ✅ Pending receipt bar */}
                {pendingReceipt && (
                    <div className="rounded-2xl border p-4 bg-emerald-50">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="font-medium text-emerald-900">Receipt ready to attach ✅</div>
                                <div className="text-sm text-emerald-800 break-all">
                                    {pendingReceipt.receipt_id ? `receipt_id: ${pendingReceipt.receipt_id} • ` : ""}
                                    {pendingReceipt.receipt_url}
                                </div>
                                <div className="mt-1 text-xs text-emerald-800">
                                    เลือก transaction ด้านล่าง แล้วกด “Attach this”
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <a
                                    href={pendingReceipt.receipt_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-xl border px-3 py-2 text-sm hover:bg-white"
                                >
                                    Preview
                                </a>

                                <Link
                                    href={`/transactions/new?receipt_url=${encodeURIComponent(pendingReceipt.receipt_url)}`}
                                    className="rounded-xl border px-3 py-2 text-sm hover:bg-white"
                                >
                                    Create new with this
                                </Link>

                                <button
                                    onClick={clearPending}
                                    className="rounded-xl border px-3 py-2 text-sm hover:bg-white"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {err && <div className="rounded-xl border p-3 text-red-600">{err}</div>}

                {/* List */}
                {loading ? (
                    <div className="rounded-xl border p-6">Loading...</div>
                ) : data.results.length === 0 ? (
                    <div className="rounded-xl border p-6">
                        No transactions found for these filters.{" "}
                        <Link href="/transactions/new" className="underline">
                            Create one
                        </Link>
                        .
                    </div>
                ) : (
                    <div className="space-y-3">
                        {data.results.map((tx) => (
                            <TransactionCard
                                key={tx.id}
                                tx={tx}
                                pendingReceiptUrl={pendingReceipt?.receipt_url ?? null}
                                onAttachPending={onAttachPending}
                                attaching={attachingId === tx.id}
                                uploading={uploadingId === tx.id}
                                onUploadReceipt={onUploadReceipt}
                            />
                        ))}
                    </div>
                )}

                {/* Pagination controls */}
                {!loading && data.count > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-4">
                        <div className="text-sm text-gray-600">
                            Page <span className="font-medium">{page}</span> /{" "}
                            <span className="font-medium">{totalPages}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => {
                                    const next = Math.max(1, page - 1);
                                    setPage(next);
                                    pushQuery({ page: String(next) });
                                }}
                                className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
                            >
                                Prev
                            </button>

                            <button
                                disabled={page >= totalPages}
                                onClick={() => {
                                    const next = Math.min(totalPages, page + 1);
                                    setPage(next);
                                    pushQuery({ page: String(next) });
                                }}
                                className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedLayout>
    );
}

function TransactionCard({
    tx,
    pendingReceiptUrl,
    onAttachPending,
    attaching,
    uploading,
    onUploadReceipt,
}: {
    tx: Transaction;
    pendingReceiptUrl: string | null;
    onAttachPending: (txId: number) => Promise<void>;
    attaching: boolean;
    uploading: boolean;
    onUploadReceipt: (txId: number, file: File) => Promise<void>;
}) {
    const date = useMemo(() => fmtDateTime(tx.occurred_at), [tx.occurred_at]);

    // ✅ แนะนำใช้ abs_url ถ้ามี
    const receiptLink = tx.receipt_abs_url ?? tx.receipt_url;

    return (
        <div className="rounded-2xl border p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="font-medium truncate">
                        {tx.type.toUpperCase()} • {tx.merchant || "—"}
                    </div>

                    <div className="text-sm text-gray-600">
                        {date} • Wallet: {tx.wallet?.name || "—"} • Amount: {tx.amount} {tx.currency?.code || ""}
                    </div>

                    {tx.category?.name && (
                        <div className="text-xs text-gray-500 mt-1">Category: {tx.category.name}</div>
                    )}

                    {tx.note && <div className="text-sm text-gray-700 mt-1 wrap-break-word">{tx.note}</div>}
                </div>

                <div className="text-right shrink-0">
                    <div className="text-sm text-gray-600">Base</div>
                    <div className="font-semibold">{tx.base_amount}</div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Link href={`/transactions/${tx.id}/edit`} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                    Edit
                </Link>

                {pendingReceiptUrl && (
                    <button
                        onClick={() => onAttachPending(tx.id)}
                        disabled={attaching}
                        className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
                    >
                        {attaching ? "Attaching..." : "Attach this"}
                    </button>
                )}

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
                            onUploadReceipt(tx.id, f);
                            e.currentTarget.value = "";
                        }}
                    />
                </label>

                {receiptLink ? (
                    <a className="text-sm underline text-blue-600" href={receiptLink} target="_blank" rel="noreferrer">
                        View receipt
                    </a>
                ) : (
                    <span className="text-sm text-gray-500">No receipt</span>
                )}
            </div>
        </div>
    );
}
