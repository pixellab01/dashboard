'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface CancellationData {
  order_week: string
  total_cancellations: number
  total_cancelled_value: number
  cancellations: Array<{
    reason: string
    count: number
    value: number
  }>
}

interface Props {
  data: CancellationData[]
}

export default function CancellationChart({ data }: Props) {
  // Aggregate cancellation reasons across all weeks
  const reasonMap = new Map<string, number>()
  data.forEach((week) => {
    week.cancellations.forEach((cancel) => {
      const current = reasonMap.get(cancel.reason) || 0
      reasonMap.set(cancel.reason, current + cancel.count)
    })
  })

  const reasonData = Array.from(reasonMap.entries()).map(([reason, count]) => ({
    reason,
    count,
  }))

  return (
    <div className="space-y-6">
      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Cancellation Trends</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="order_week" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
            />
            <Legend wrapperStyle={{ color: '#F9FAFB' }} />
            <Line
              type="monotone"
              dataKey="total_cancellations"
              stroke="#EF4444"
              strokeWidth={2}
              name="Total Cancellations"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Cancellation Reasons</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={reasonData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#9CA3AF" />
            <YAxis dataKey="reason" type="category" stroke="#9CA3AF" width={200} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
            />
            <Legend wrapperStyle={{ color: '#F9FAFB' }} />
            <Bar dataKey="count" fill="#EF4444" name="Cancellation Count" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Cancelled Value Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="order_week" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
              formatter={(value: number) => `₹${value.toLocaleString()}`}
            />
            <Legend wrapperStyle={{ color: '#F9FAFB' }} />
            <Bar dataKey="total_cancelled_value" fill="#F97316" name="Cancelled Value" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
