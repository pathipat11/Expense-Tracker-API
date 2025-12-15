import ProtectedLayout from "@/components/ProtectedLayout";

export default function RecurringPage() {
    return (
        <ProtectedLayout>
            <h1 className="text-2xl font-semibold">Recurring (AI)</h1>
            <p className="mt-2 text-sm text-gray-600">
                Monthly summary generated from reports (template or OpenAI).
            </p>
        </ProtectedLayout>
    );
}
