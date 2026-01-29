'use client'

import { useState, useEffect } from 'react'

interface DateRangeFilterProps {
  onDateChange: (startDate: string | null, endDate: string | null) => void
  defaultStartDate?: string
  defaultEndDate?: string
}

export default function DateRangeFilter({
  onDateChange,
  defaultStartDate,
  defaultEndDate,
}: DateRangeFilterProps) {
  const [startDate, setStartDate] = useState<string>(defaultStartDate || '')
  const [endDate, setEndDate] = useState<string>(defaultEndDate || '')
  const [preset, setPreset] = useState<string>(defaultStartDate && defaultEndDate ? 'custom' : 'all')

  useEffect(() => {
    // Initialize dates only once
    if (defaultStartDate && defaultEndDate) {
      setStartDate(defaultStartDate)
      setEndDate(defaultEndDate)
      // Don't call onDateChange here to avoid double-fetching
    } else {
      // Default to "All Time" - no date filtering
      onDateChange(null, null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePresetChange = (presetValue: string) => {
    setPreset(presetValue)
    const end = new Date()
    const start = new Date()
    
    switch (presetValue) {
      case 'last7days':
        start.setDate(start.getDate() - 7)
        break
      case 'last30days':
        start.setDate(start.getDate() - 30)
        break
      case 'last90days':
        start.setDate(start.getDate() - 90)
        break
      case 'last12weeks':
        start.setDate(start.getDate() - 84) // 12 weeks = 84 days
        break
      case 'thisMonth':
        start.setDate(1)
        break
      case 'lastMonth':
        start.setMonth(start.getMonth() - 1)
        start.setDate(1)
        end.setDate(0) // Last day of previous month
        break
      case 'thisYear':
        start.setMonth(0, 1)
        break
      case 'all':
        setStartDate('')
        setEndDate('')
        onDateChange(null, null)
        return
      default:
        return
    }
    
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    
    setStartDate(startStr)
    setEndDate(endStr)
    onDateChange(startStr, endStr)
  }

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value)
    setPreset('custom')
    onDateChange(e.target.value || null, endDate || null)
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value)
    setPreset('custom')
    onDateChange(startDate || null, e.target.value || null)
  }

  return (
    <div className="bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-gray-700/50 mb-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-gray-300 text-sm font-medium whitespace-nowrap">Time Period:</label>
          <select
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
            <option value="last90days">Last 90 Days</option>
            <option value="last12weeks">Last 12 Weeks</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="thisYear">This Year</option>
            <option value="all">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <label className="text-gray-300 text-sm font-medium whitespace-nowrap">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label className="text-gray-300 text-sm font-medium whitespace-nowrap">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              min={startDate}
              className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>
    </div>
  )
}
