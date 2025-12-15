import { api } from "@/lib/api";

export type Category = { id: number; name: string; type: string };

export async function listCategories(type?: "expense" | "income") {
    const res = await api.get("/api/categories/", { params: type ? { type } : {} });
    return res.data as Category[];
}
