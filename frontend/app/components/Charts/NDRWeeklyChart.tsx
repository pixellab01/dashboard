'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface NDRWeeklyData {
  order_week: string
  total_ndr: number
  ndr_delivered_after: number
  ndr_conversion_percent: number
  total_order_value: number
}

interface Props {
  data: NDRWeeklyData[]
}

export default function NDRWeeklyChart({ data }: Props) {
  return (
    <div className="space-y-6">
      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">NDR Trends</h3>
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
              dataKey="total_ndr"
              stroke="#FCD34D"
              strokeWidth={2}
              name="Total NDR"
            />
            <Line
              type="monotone"
              dataKey="ndr_delivered_after"
              stroke="#10B981"
              strokeWidth={2}
              name="Delivered After NDR"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">NDR Conversion Rate</h3>
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
              formatter={(value: number) => `${value.toFixed(2)}%`}
            />
            <Legend wrapperStyle={{ color: '#F9FAFB' }} />
            <Bar dataKey="ndr_conversion_percent" fill="#3B82F6" name="Conversion %" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
