import { api } from "@/lib/api";

export type Wallet = {
    id: number;
    name: string;
    type: string;
    is_active?: boolean;
    currency?: { code: string; symbol?: string };
};

type Paginated<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

export async function listWallets() {
    const res = await api.get("/api/wallets/");
    const data = res.data;

    if (data && typeof data === "object" && Array.isArray(data.results)) {
        return (data as Paginated<Wallet>).results;
    }

    if (Array.isArray(data)) return data as Wallet[];

    // fallback
    return [];
}
