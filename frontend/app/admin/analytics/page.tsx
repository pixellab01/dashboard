import React, { Suspense } from 'react'
import { computeAnalytics, getFilterOptions } from '@/lib/api-client'
import InteractiveDashboard from './InteractiveDashboard'
import { FilterState } from '@/app/components/AnalyticsFilters'

export default async function AnalyticsDashboardPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const resolvedParams = await searchParams;
    const sessionId = typeof resolvedParams?.sessionId === 'string' ? resolvedParams.sessionId : null;

    // Default initial filters
    const initialFilters: FilterState = {
        startDate: null,
        endDate: null,
        orderStatus: 'All',
        paymentMethod: 'All',
        channel: 'All',
        state: [],
        courier: [],
        sku: 'All',
        productName: 'All',
    }

    let initialAnalyticsData = {};
    let initialFilterOptions = {};

    if (sessionId) {
        try {
            // Fetch initial filter options on the server
            // We SKIP fetching heavy analytics data here to prevent OOM during SSR serialization
            // The client component will fetch the data via useEffect
            const filterOptionsResult = await getFilterOptions(sessionId);
            if (filterOptionsResult.success) {
                initialFilterOptions = filterOptionsResult.data;
            }
        } catch (error) {
            console.error("Failed to fetch initial data on the server", error)
        }
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
            <header className="mb-8">
                <h1 className="text-4xl font-bold text-center text-gray-100">Analytics Dashboard</h1>
            </header>
            <main>
                <Suspense fallback={<div>Loading Dashboard...</div>}>
                    <InteractiveDashboard
                        initialAnalyticsData={initialAnalyticsData}
                        initialFilterOptions={initialFilterOptions}
                        serverSessionId={sessionId}
                    />
                </Suspense>
            </main>
        </div>
    )
}
