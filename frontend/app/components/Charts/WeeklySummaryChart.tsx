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

const ResponsiveContainerAny = ResponsiveContainer as any
const LineChartAny = LineChart as any
const LineAny = Line as any
const AreaChartAny = AreaChart as any
const AreaAny = Area as any
const BarChartAny = BarChart as any
const BarAny = Bar as any
const XAxisAny = XAxis as any
const YAxisAny = YAxis as any
const CartesianGridAny = CartesianGrid as any
const TooltipAny = Tooltip as any
const LegendAny = Legend as any
const ComposedChartAny = ComposedChart as any


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
        <ResponsiveContainerAny width="100%" height={300}>
          <ComposedChartAny data={data}>
            <CartesianGridAny strokeDasharray="3 3" stroke="#374151" />
            <XAxisAny dataKey="order_week" stroke="#9CA3AF" />
            <YAxisAny yAxisId="left" stroke="#9CA3AF" />
            <YAxisAny yAxisId="right" orientation="right" stroke="#9CA3AF" />
            <TooltipAny
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
            />
            <LegendAny wrapperStyle={{ color: '#F9FAFB' }} />
            <BarAny yAxisId="left" dataKey="total_orders" fill="#3B82F6" name="Total Orders" />
            <LineAny
              yAxisId="right"
              type="monotone"
              dataKey="avg_order_value"
              stroke="#10B981"
              strokeWidth={2}
              name="Avg Order Value"
            />
          </ComposedChartAny>
        </ResponsiveContainerAny>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Delivery Status Breakdown</h3>
        <ResponsiveContainerAny width="100%" height={300}>
          <AreaChartAny data={data}>
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
            <AreaAny
              type="monotone"
              dataKey="del_count"
              stackId="1"
              stroke="#10B981"
              fill="#10B981"
              name="Delivered"
            />
            <AreaAny
              type="monotone"
              dataKey="ofd_count"
              stackId="1"
              stroke="#3B82F6"
              fill="#3B82F6"
              name="OFD"
            />
            <AreaAny
              type="monotone"
              dataKey="fad_count"
              stackId="1"
              stroke="#F59E0B"
              fill="#F59E0B"
              name="FAD"
            />
            <AreaAny
              type="monotone"
              dataKey="ndr_count"
              stackId="1"
              stroke="#FCD34D"
              fill="#FCD34D"
              name="NDR"
            />
            <AreaAny
              type="monotone"
              dataKey="rto_count"
              stackId="1"
              stroke="#EF4444"
              fill="#EF4444"
              name="RTO"
            />
          </AreaChartAny>
        </ResponsiveContainerAny>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Performance Rates</h3>
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
              formatter={(value: number) => `${value.toFixed(2)}%`}
            />
            <LegendAny wrapperStyle={{ color: '#F9FAFB' }} />
            <LineAny
              type="monotone"
              dataKey="del_percent"
              stroke="#10B981"
              strokeWidth={2}
              name="Delivery %"
            />
            <LineAny
              type="monotone"
              dataKey="ndr_rate_percent"
              stroke="#FCD34D"
              strokeWidth={2}
              name="NDR Rate %"
            />
            <LineAny
              type="monotone"
              dataKey="rto_rate_percent"
              stroke="#EF4444"
              strokeWidth={2}
              name="RTO Rate %"
            />
          </LineChartAny>
        </ResponsiveContainerAny>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Average Turnaround Time (TAT)</h3>
        <ResponsiveContainerAny width="100%" height={300}>
          <BarChartAny data={data}>
            <CartesianGridAny strokeDasharray="3 3" stroke="#374151" />
            <XAxisAny dataKey="order_week" stroke="#9CA3AF" />
            <YAxisAny stroke="#9CA3AF" label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
            <TooltipAny
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
              formatter={(value: number) => `${value?.toFixed(1) || 'N/A'} hours`}
            />
            <LegendAny wrapperStyle={{ color: '#F9FAFB' }} />
            <BarAny dataKey="avg_total_tat" fill="#8B5CF6" name="Avg TAT (hours)" />
          </BarChartAny>
        </ResponsiveContainerAny>
      </div>
    </div>
  )
}
