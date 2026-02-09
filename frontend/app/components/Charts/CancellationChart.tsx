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

// Cast all components to any to bypass type errors
const ResponsiveContainerAny = ResponsiveContainer as any
const BarChartAny = BarChart as any
const BarAny = Bar as any
const LineChartAny = LineChart as any
const LineAny = Line as any
const XAxisAny = XAxis as any
const YAxisAny = YAxis as any
const CartesianGridAny = CartesianGrid as any
const TooltipAny = Tooltip as any
const LegendAny = Legend as any


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
        <ResponsiveContainerAny width="100%" height={300}>
          <LineChartAny data={data}>
            <CartesianGridAny strokeDasharray="3 3" stroke="#374151" />
            <XAxisAny dataKey="order_week" stroke="#9CA3AF" />
            <YAxisAny stroke="#9CA3AF" />
            <TooltipAny
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
            />
            <LegendAny wrapperStyle={{ color: '#F9FAFB' }} />
            <LineAny
              type="monotone"
              dataKey="total_cancellations"
              stroke="#EF4444"
              strokeWidth={2}
              name="Total Cancellations"
            />
          </LineChartAny>
        </ResponsiveContainerAny>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Cancellation Reasons</h3>
        <ResponsiveContainerAny width="100%" height={400}>
          <BarChartAny data={reasonData} layout="vertical">
            <CartesianGridAny strokeDasharray="3 3" stroke="#374151" />
            <XAxisAny type="number" stroke="#9CA3AF" />
            <YAxisAny dataKey="reason" type="category" stroke="#9CA3AF" width={200} />
            <TooltipAny
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
            />
            <LegendAny wrapperStyle={{ color: '#F9FAFB' }} />
            <BarAny dataKey="count" fill="#EF4444" name="Cancellation Count" />
          </BarChartAny>
        </ResponsiveContainerAny>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Cancelled Value Trend</h3>
        <ResponsiveContainerAny width="100%" height={300}>
          <BarChartAny data={data}>
            <CartesianGridAny strokeDasharray="3 3" stroke="#374151" />
            <XAxisAny dataKey="order_week" stroke="#9CA3AF" />
            <YAxisAny stroke="#9CA3AF" />
            <TooltipAny
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
              formatter={(value: number) => `₹${value.toLocaleString()}`}
            />
            <LegendAny wrapperStyle={{ color: '#F9FAFB' }} />
            <BarAny dataKey="total_cancelled_value" fill="#F97316" name="Cancelled Value" />
          </BarChartAny>
        </ResponsiveContainerAny>
      </div>
    </div>
  )
}
