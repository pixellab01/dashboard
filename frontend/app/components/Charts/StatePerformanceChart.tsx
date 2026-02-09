'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const ResponsiveContainerAny = ResponsiveContainer as any
const BarChartAny = BarChart as any
const BarAny = Bar as any
const XAxisAny = XAxis as any
const YAxisAny = YAxis as any
const CartesianGridAny = CartesianGrid as any
const TooltipAny = Tooltip as any
const LegendAny = Legend as any
const PieChartAny = PieChart as any
const PieAny = Pie as any
const CellAny = Cell as any


interface StatePerformanceData {
  state: string
  total_orders: number
  delivered: number
  delivery_percent: number
  ndr_rate: number
  rto_rate: number
  total_order_value: number
  avg_order_value: number
  order_share: number
}

interface Props {
  data: StatePerformanceData[]
  limit?: number
  channelData?: Array<{
    channel: string
    total_orders: number
    share_percent: number
    value_share_percent: number
    delivered: number
    delivery_percent: number
  }>
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#A855F7', '#EC4899', '#14B8A6']

export default function StatePerformanceChart({ data, limit, channelData }: Props) {
  // Show all states if no limit is provided, otherwise use limit
  const displayStates = limit ? data.slice(0, limit) : data
  // Use channel data for pie chart if provided, otherwise use state data
  const pieData = channelData && channelData.length > 0
    ? channelData.map((channel) => ({
      name: channel.channel,
      value: channel.share_percent,
    }))
    : displayStates.map((state) => ({
      name: state.state,
      value: state.order_share,
    }))

  return (
    <div className="space-y-6">
      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">
          {limit ? `Top ${limit} States` : 'All States'} by Order Volume ({displayStates.length} states)
        </h3>
        <div className="overflow-x-auto" style={{ minWidth: '600px' }}>
          <ResponsiveContainerAny width={Math.max(600, displayStates.length * 80)} height={400}>
            <BarChartAny data={displayStates}>
              <CartesianGridAny strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="state"
                stroke="#9CA3AF"
                angle={-45}
                textAnchor="end"
                height={Math.min(150, displayStates.length * 12)}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <YAxis
                type="number"
                stroke="#9CA3AF"
                label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-xl font-bold text-white mb-4">
            {channelData && channelData.length > 0 ? 'Channel Share' : 'State Order Share'}
          </h3>
          <ResponsiveContainerAny width="100%" height={450}>
            <PieChartAny>
              <PieAny
                data={pieData}
                cx="50%"
                cy="45%"
                labelLine={true}
                label={({ name, percent }) => {
                  // Only show label if slice is > 5% to avoid overlap
                  if (percent < 0.05) return ''
                  return `${name}\n${(percent * 100).toFixed(1)}%`
                }}
                outerRadius={130}
                innerRadius={50}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={3}
              >
                {pieData.map((entry, index) => (
                  <CellAny key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </PieAny>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB',
                }}
                formatter={(value: number) => `${value.toFixed(2)}%`}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                wrapperStyle={{ color: '#F9FAFB' }}
                formatter={(value) => value}
                iconType="circle"
              />
            </PieChartAny>
          </ResponsiveContainerAny>
        </div>

        <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-xl font-bold text-white mb-4">Delivery Performance</h3>
          <ResponsiveContainerAny width="100%" height={450}>
            <PieChartAny>
              <PieAny
                data={(() => {
                  const deliveryData = [
                    {
                      name: 'Delivered',
                      value: displayStates.reduce((sum, state) => sum + (state.delivered || 0), 0),
                      fill: '#10B981',
                    },
                    {
                      name: 'NDR',
                      value: displayStates.reduce((sum, state) => {
                        const ndrCount = Math.round((state.total_orders * (state.ndr_rate || 0)) / 100)
                        return sum + ndrCount
                      }, 0),
                      fill: '#FCD34D',
                    },
                    {
                      name: 'RTO',
                      value: displayStates.reduce((sum, state) => {
                        const rtoCount = Math.round((state.total_orders * (state.rto_rate || 0)) / 100)
                        return sum + rtoCount
                      }, 0),
                      fill: '#EF4444',
                    },
                    {
                      name: 'Pending',
                      value: displayStates.reduce((sum, state) => {
                        const delivered = state.delivered || 0
                        const ndr = Math.round((state.total_orders * (state.ndr_rate || 0)) / 100)
                        const rto = Math.round((state.total_orders * (state.rto_rate || 0)) / 100)
                        return sum + Math.max(0, (state.total_orders || 0) - delivered - ndr - rto)
                      }, 0),
                      fill: '#6B7280',
                    },
                  ].filter(item => item.value > 0)

                  const total = deliveryData.reduce((sum, item) => sum + item.value, 0)

                  return deliveryData.map(item => ({
                    ...item,
                    percent: total > 0 ? (item.value / total) * 100 : 0,
                  }))
                })()}
                cx="50%"
                cy="45%"
                labelLine={true}
                label={({ name, percent }) => {
                  // Only show label if slice is > 5% to avoid overlap
                  if (percent < 5) return ''
                  return `${name}\n${percent.toFixed(1)}%`
                }}
                outerRadius={130}
                innerRadius={50}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={3}
              >
                {[
                  { name: 'Delivered', fill: '#10B981' },
                  { name: 'NDR', fill: '#FCD34D' },
                  { name: 'RTO', fill: '#EF4444' },
                  { name: 'Pending', fill: '#6B7280' },
                ].map((entry, index) => (
                  <CellAny key={`delivery-cell-${index}`} fill={entry.fill} />
                ))}
              </PieAny>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB',
                }}
                formatter={(value: number, name: string) => {
                  const total = displayStates.reduce((sum, state) => sum + (state.total_orders || 0), 0)
                  const percent = total > 0 ? ((value / total) * 100).toFixed(2) : '0.00'
                  return [`${value.toLocaleString()} orders (${percent}%)`, name]
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                wrapperStyle={{ color: '#F9FAFB' }}
                formatter={(value) => value}
                iconType="circle"
              />
            </PieChartAny>
          </ResponsiveContainerAny>
        </div>
      </div>
    </div>
  )
}
