import React from 'react';
import { motion } from 'framer-motion';

interface StateMetric {
    _state: string;
    order_share: number;
    total_delivered: number;
    total_orders: number;
}

interface TopTenStatesTableProps {
    data: StateMetric[];
    isLoading: boolean;
}

const TopTenStatesTable: React.FC<TopTenStatesTableProps> = ({ data, isLoading }) => {
    if (isLoading) {
        return (
            <div className="w-full h-64 flex items-center justify-center bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="w-full h-64 flex items-center justify-center bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl">
                <p className="text-gray-400">No data available</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 overflow-hidden"
        >
            <h3 className="text-lg font-semibold text-white mb-4">Top 10 States by Order Share</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-700">
                            <th className="py-3 px-4 text-gray-400 font-medium text-sm">State</th>
                            <th className="py-3 px-4 text-gray-400 font-medium text-sm text-right">Order Share</th>
                            <th className="py-3 px-4 text-gray-400 font-medium text-sm text-right">Delivered Orders</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {data.map((item, index) => (
                            <motion.tr
                                key={item._state}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="hover:bg-gray-700/30 transition-colors"
                            >
                                <td className="py-3 px-4 text-white text-sm font-medium">{item._state}</td>
                                <td className="py-3 px-4 text-gray-300 text-sm text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full"
                                                style={{ width: `${Math.min(item.order_share, 100)}%` }}
                                            />
                                        </div>
                                        <span>{item.order_share.toFixed(1)}%</span>
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-gray-300 text-sm text-right">{item.total_delivered.toLocaleString()}</td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};

export default TopTenStatesTable;
