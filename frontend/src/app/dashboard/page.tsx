import ProtectedLayout from "@/components/ProtectedLayout";

export default function DashboardPage() {
    return (
        <ProtectedLayout>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">
                Overview: balances, budget status, recent transactions, AI highlight.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Card title="Wallet Balances">Show wallet-balance report here</Card>
                <Card title="This Month Budget">Show budget status bars here</Card>
                <Card title="Recent Transactions">Show last 5 transactions</Card>
                <Card title="AI Monthly Summary">Show 3-5 bullet insights</Card>
            </div>
        </ProtectedLayout>
    );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border p-4">
            <div className="font-medium">{title}</div>
            <div className="mt-2 text-sm text-gray-600">{children}</div>
        </div>
    );
}
