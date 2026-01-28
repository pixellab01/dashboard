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

interface CategoryShareData {
  category: string
  total_orders: number
  total_order_value: number
  avg_order_value: number
  share_percent: number
  value_share_percent: number
  delivered: number
  delivery_percent: number
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
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
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
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB',
                }}
                formatter={(value: number) => `${value.toFixed(2)}%`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-xl font-bold text-white mb-4">Category Value Share</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
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
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB',
                }}
                formatter={(value: number) => `${value.toFixed(2)}%`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Category Performance</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#9CA3AF" />
            <YAxis dataKey="category" type="category" stroke="#9CA3AF" width={150} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
            />
            <Legend wrapperStyle={{ color: '#F9FAFB' }} />
            <Bar dataKey="total_orders" fill="#3B82F6" name="Total Orders" />
            <Bar dataKey="delivered" fill="#10B981" name="Delivered" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Category Delivery Rates</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="category" stroke="#9CA3AF" angle={-45} textAnchor="end" height={100} />
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
            <Bar dataKey="delivery_percent" fill="#10B981" name="Delivery %" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
