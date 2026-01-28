'use client'

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts'

interface WeeklySummaryData {
  order_week: string
  total_orders: number
  total_order_value: number
  avg_order_value: number
  fad_count: number
  fad_percent: number
  ofd_count: number
  ofd_percent: number
  del_count: number
  del_percent: number
  ndr_count: number
  ndr_rate_percent: number
  rto_count: number
  rto_rate_percent: number
  avg_total_tat: number
}

interface Props {
  data: WeeklySummaryData[]
}

export default function WeeklySummaryChart({ data }: Props) {
  return (
    <div className="space-y-6">
      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Order Volume & Revenue Trends</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="order_week" stroke="#9CA3AF" />
            <YAxis yAxisId="left" stroke="#9CA3AF" />
            <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
            />
            <Legend wrapperStyle={{ color: '#F9FAFB' }} />
            <Bar yAxisId="left" dataKey="total_orders" fill="#3B82F6" name="Total Orders" />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avg_order_value"
              stroke="#10B981"
              strokeWidth={2}
              name="Avg Order Value"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Delivery Status Breakdown</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
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
            <Area
              type="monotone"
              dataKey="del_count"
              stackId="1"
              stroke="#10B981"
              fill="#10B981"
              name="Delivered"
            />
            <Area
              type="monotone"
              dataKey="ofd_count"
              stackId="1"
              stroke="#3B82F6"
              fill="#3B82F6"
              name="OFD"
            />
            <Area
              type="monotone"
              dataKey="fad_count"
              stackId="1"
              stroke="#F59E0B"
              fill="#F59E0B"
              name="FAD"
            />
            <Area
              type="monotone"
              dataKey="ndr_count"
              stackId="1"
              stroke="#FCD34D"
              fill="#FCD34D"
              name="NDR"
            />
            <Area
              type="monotone"
              dataKey="rto_count"
              stackId="1"
              stroke="#EF4444"
              fill="#EF4444"
              name="RTO"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Performance Rates</h3>
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
              formatter={(value: number) => `${value.toFixed(2)}%`}
            />
            <Legend wrapperStyle={{ color: '#F9FAFB' }} />
            <Line
              type="monotone"
              dataKey="del_percent"
              stroke="#10B981"
              strokeWidth={2}
              name="Delivery %"
            />
            <Line
              type="monotone"
              dataKey="ndr_rate_percent"
              stroke="#FCD34D"
              strokeWidth={2}
              name="NDR Rate %"
            />
            <Line
              type="monotone"
              dataKey="rto_rate_percent"
              stroke="#EF4444"
              strokeWidth={2}
              name="RTO Rate %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Average Turnaround Time (TAT)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="order_week" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
              formatter={(value: number) => `${value?.toFixed(1) || 'N/A'} hours`}
            />
            <Legend wrapperStyle={{ color: '#F9FAFB' }} />
            <Bar dataKey="avg_total_tat" fill="#8B5CF6" name="Avg TAT (hours)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
