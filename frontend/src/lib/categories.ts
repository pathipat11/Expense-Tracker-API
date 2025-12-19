import { api } from "@/lib/api";

export type Category = {
    id: number;
    type: "expense" | "income";
    name: string;
    parent?: number | null;
};

type Paginated<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

export async function listCategories(params?: { type?: "expense" | "income" }) {
    const res = await api.get("/api/categories/", { params });
    const data = res.data;

    if (data && typeof data === "object" && Array.isArray(data.results)) {
        return (data as Paginated<Category>).results;
    }

    if (Array.isArray(data)) return data as Category[];

    return [];
}
