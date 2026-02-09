'use client'

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// Cast all components to any to bypass type errors
const ResponsiveContainerAny = ResponsiveContainer as any
const PieChartAny = PieChart as any
const PieAny = Pie as any
const CellAny = Cell as any
const BarChartAny = BarChart as any
const BarAny = Bar as any
const XAxisAny = XAxis as any
const YAxisAny = YAxis as any
const CartesianGridAny = CartesianGrid as any
const TooltipAny = Tooltip as any
const LegendAny = Legend as any


interface CategoryShareData {
  category: string
  total_orders: number
  total_order_value: number
  avg_order_value: number
  share_percent: number
  value_share_percent: number
  delivered: number
  delivery_percent: number
  [key: string]: string | number
}

interface Props {
  data: CategoryShareData[]
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']

export default function CategoryShareChart({ data }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-xl font-bold text-white mb-4">Category Order Share</h3>
          <ResponsiveContainerAny width="100%" height={300}>
            <PieChartAny>
              <PieAny
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="share_percent"
              >
                {data.map((entry, index) => (
                  <CellAny key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </PieAny>
              <TooltipAny
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB',
                }}
                formatter={(value: number) => `${value.toFixed(2)}%`}
              />
            </PieChartAny>
          </ResponsiveContainerAny>
        </div>

        <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-xl font-bold text-white mb-4">Category Value Share</h3>
          <ResponsiveContainerAny width="100%" height={300}>
            <PieChartAny>
              <PieAny
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value_share_percent"
              >
                {data.map((entry, index) => (
                  <CellAny key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </PieAny>
              <TooltipAny
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB',
                }}
                formatter={(value: number) => `${value.toFixed(2)}%`}
              />
            </PieChartAny>
          </ResponsiveContainerAny>
        </div>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Category Performance</h3>
        <ResponsiveContainerAny width="100%" height={400}>
          <BarChartAny data={data} layout="vertical">
            <CartesianGridAny strokeDasharray="3 3" stroke="#374151" />
            <XAxisAny type="number" stroke="#9CA3AF" />
            <YAxisAny dataKey="category" type="category" stroke="#9CA3AF" width={150} />
            <TooltipAny
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
            />
            <LegendAny wrapperStyle={{ color: '#F9FAFB' }} />
            <BarAny dataKey="total_orders" fill="#3B82F6" name="Total Orders" />
            <BarAny dataKey="delivered" fill="#10B981" name="Delivered" />
          </BarChartAny>
        </ResponsiveContainerAny>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Category Delivery Rates</h3>
        <ResponsiveContainerAny width="100%" height={300}>
          <BarChartAny data={data}>
            <CartesianGridAny strokeDasharray="3 3" stroke="#374151" />
            <XAxisAny dataKey="category" stroke="#9CA3AF" angle={-45} textAnchor="end" height={100} />
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
            <BarAny dataKey="delivery_percent" fill="#10B981" name="Delivery %" />
          </BarChartAny>
        </ResponsiveContainerAny>
      </div>
    </div>
  )
}
