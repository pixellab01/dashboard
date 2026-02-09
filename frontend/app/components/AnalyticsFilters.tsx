'use client'

import { useState, useMemo, useEffect, useRef } from 'react'

export interface FilterState {
  startDate: string | null
  endDate: string | null
  orderStatus: string[] | string
  paymentMethod: string[] | string
  channel: string[] | string
  state: string[] | string
  courier: string[] | string
  sku: string[] | string
  productName: string[] | string
  ndrDescription?: string[] | string
}

interface AnalyticsFiltersProps {
  onFilterChange: (filters: FilterState) => void
  availableChannels: string[]
  availableSkus: string[]
  availableSkusTop10: string[]
  availableProductNames: string[]
  availableProductNamesTop10: string[]
  availableStatuses: string[]
  availablePaymentMethods?: string[]
  availableStates?: string[]
  availableCouriers?: string[]
  availableNdrDescriptions?: string[]
  sessionId?: string
  onFilterOptionsChange?: (channel?: string, sku?: string) => void
}

export default function AnalyticsFilters({
  onFilterChange,
  availableChannels,
  availableSkus,
  availableSkusTop10,
  availableProductNames,
  availableProductNamesTop10,
  availableStatuses,
  availablePaymentMethods = [],
  availableStates = [],
  availableCouriers = [],
  availableNdrDescriptions = [],
  sessionId,
  onFilterOptionsChange,
}: AnalyticsFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    startDate: null,
    endDate: null,
    orderStatus: [],
    paymentMethod: [],
    channel: [],
    state: [],
    courier: [],
    sku: [],
    productName: [],
    ndrDescription: [],
  })

  const [isCustomRange, setIsCustomRange] = useState(false)
  const [skuSearch, setSkuSearch] = useState('')
  const [productNameSearch, setProductNameSearch] = useState('')
  const [stateSearch, setStateSearch] = useState('')
  const [courierSearch, setCourierSearch] = useState('')
  const [ndrDescriptionSearch, setNdrDescriptionSearch] = useState('')
  const [channelSearch, setChannelSearch] = useState('')
  const [orderStatusSearch, setOrderStatusSearch] = useState('')
  const [paymentMethodSearch, setPaymentMethodSearch] = useState('')

  const [showSkuSearch, setShowSkuSearch] = useState(false)
  const [showProductNameSearch, setShowProductNameSearch] = useState(false)
  const [showStateSearch, setShowStateSearch] = useState(false)
  const [showCourierSearch, setShowCourierSearch] = useState(false)
  const [showNdrDescriptionSearch, setShowNdrDescriptionSearch] = useState(false)
  const [showChannelSearch, setShowChannelSearch] = useState(false)
  const [showOrderStatusSearch, setShowOrderStatusSearch] = useState(false)
  const [showPaymentMethodSearch, setShowPaymentMethodSearch] = useState(false)

  const skuSearchRef = useRef<HTMLDivElement>(null)
  const productNameSearchRef = useRef<HTMLDivElement>(null)
  const stateSearchRef = useRef<HTMLDivElement>(null)
  const courierSearchRef = useRef<HTMLDivElement>(null)
  const ndrDescriptionSearchRef = useRef<HTMLDivElement>(null)
  const channelSearchRef = useRef<HTMLDivElement>(null)
  const orderStatusSearchRef = useRef<HTMLDivElement>(null)
  const paymentMethodSearchRef = useRef<HTMLDivElement>(null)

  // Cascading filter options - filtered based on channel/SKU selection
  const [filteredSkus, setFilteredSkus] = useState<string[]>(availableSkus)
  const [filteredSkusTop10, setFilteredSkusTop10] = useState<string[]>(availableSkusTop10)
  const [filteredProductNames, setFilteredProductNames] = useState<string[]>(availableProductNames)
  const [filteredProductNamesTop10, setFilteredProductNamesTop10] = useState<string[]>(availableProductNamesTop10)

  // Helper to get selected SKUs as array
  const selectedSkus = Array.isArray(filters.sku) ? filters.sku : (filters.sku === 'All' || !filters.sku ? [] : [filters.sku])

  // Helper to get selected Product Names as array
  const selectedProductNames = Array.isArray(filters.productName) ? filters.productName : (filters.productName === 'All' || !filters.productName ? [] : [filters.productName])

  // Helper to get selected States as array
  const selectedStates = Array.isArray(filters.state) ? filters.state : (filters.state === 'All' || !filters.state ? [] : [filters.state])

  // Helper to get selected Couriers as array
  const selectedCouriers = Array.isArray(filters.courier) ? filters.courier : (filters.courier === 'All' || !filters.courier ? [] : [filters.courier])

  // Helper to get selected NDR Descriptions as array
  const selectedNdrDescriptions = Array.isArray(filters.ndrDescription) ? filters.ndrDescription : (filters.ndrDescription === 'All' || !filters.ndrDescription ? [] : [filters.ndrDescription])

  // Sync filtered options with props when no channel/SKU filter is active
  useEffect(() => {
    const channelEmpty = Array.isArray(filters.channel) ? filters.channel.length === 0 : filters.channel === 'All' || !filters.channel
    if (channelEmpty) {
      setFilteredSkus(availableSkus)
      setFilteredSkusTop10(availableSkusTop10)
    }
  }, [availableSkus, availableSkusTop10, filters.channel])

  useEffect(() => {
    if (selectedSkus.length === 0) {
      setFilteredProductNames(availableProductNames)
      setFilteredProductNamesTop10(availableProductNamesTop10)
    }
  }, [availableProductNames, availableProductNamesTop10, selectedSkus.length])

  // Fetch filtered options when channel or SKU changes
  useEffect(() => {
    if (!sessionId) {
      // Reset to original options if no sessionId
      setFilteredSkus(availableSkus)
      setFilteredSkusTop10(availableSkusTop10)
      setFilteredProductNames(availableProductNames)
      setFilteredProductNamesTop10(availableProductNamesTop10)
      return
    }

    const fetchFilteredOptions = async () => {
      try {
        const params = new URLSearchParams()
        params.append('sessionId', sessionId)
        if (filters.channel && filters.channel !== 'All' && filters.channel.length > 0) {
          // If channel is array, potentially send multiple? API might expect one or comma-separated.
          // For now, if multiple channels selected, maybe don't filter options or send all?
          // The API endpoint likely needs to handle list. 
          // Assuming API `filter-options` might only handle single channel for cascading for now, 
          // OR we need to update it. 
          // Let's pass array as comma separated if it's an array, or single string.
          const channelVal = Array.isArray(filters.channel) ? filters.channel.join(',') : filters.channel
          params.append('channel', channelVal)
        }
        if (selectedSkus.length > 0 && selectedSkus[0]) {
          params.append('sku', selectedSkus[0]) // Use first selected SKU for filtering
        }

        const response = await fetch(`/api/analytics/filter-options?${params.toString()}`)
        const data = await response.json()

        if (data.success) {
          // Update SKU options if channel is selected
          const channelActive = Array.isArray(filters.channel) ? filters.channel.length > 0 : filters.channel !== 'All' && filters.channel

          if (channelActive) {
            setFilteredSkus(data.skus || [])
            setFilteredSkusTop10(data.skusTop10 || [])
          } else {
            setFilteredSkus(availableSkus)
            setFilteredSkusTop10(availableSkusTop10)
          }

          // Update Product Name options if SKU is selected
          if (selectedSkus.length > 0 && selectedSkus[0]) {
            setFilteredProductNames(data.productNames || [])
            setFilteredProductNamesTop10(data.productNamesTop10 || [])
          } else {
            setFilteredProductNames(availableProductNames)
            setFilteredProductNamesTop10(availableProductNamesTop10)
          }

          // Clear selections if they're no longer valid
          const channelActiveForSku = Array.isArray(filters.channel) ? filters.channel.length > 0 : filters.channel !== 'All' && filters.channel
          if (channelActiveForSku) {
            const validSkus = data.skus || []
            const currentSkus = selectedSkus.filter(sku => validSkus.includes(sku))
            if (currentSkus.length !== selectedSkus.length) {
              setFilters(prev => ({ ...prev, sku: currentSkus.length > 0 ? currentSkus : [] }))
            }
          }

          if (selectedSkus.length > 0 && selectedSkus[0]) {
            const validProducts = data.productNames || []
            const currentProducts = selectedProductNames.filter(name => validProducts.includes(name))
            if (currentProducts.length !== selectedProductNames.length) {
              setFilters(prev => ({ ...prev, productName: currentProducts.length > 0 ? currentProducts : [] }))
            }
          }
        }
      } catch (error) {
        console.error('Error fetching filtered options:', error)
        // Fallback to original options on error
        setFilteredSkus(availableSkus)
        setFilteredSkusTop10(availableSkusTop10)
        setFilteredProductNames(availableProductNames)
        setFilteredProductNamesTop10(availableProductNamesTop10)
      }
    }

    fetchFilteredOptions()
  }, [sessionId, Array.isArray(filters.channel) ? filters.channel.join(',') : filters.channel, selectedSkus.join(','), availableSkus, availableSkusTop10, availableProductNames, availableProductNamesTop10, selectedProductNames.length])

  // Reset filtered options when channel/SKU is cleared (handled in main useEffect above)

  // Filter SKUs based on search (from filtered options)
  const searchedSkus = useMemo(() => {
    if (!skuSearch.trim()) return []
    const searchLower = skuSearch.toLowerCase()
    return filteredSkus
      .filter(sku => sku.toLowerCase().includes(searchLower))
      .slice(0, 20) // Limit to 20 results for performance
  }, [skuSearch, filteredSkus])

  // Filter Product Names based on search (from filtered options)
  const searchedProductNames = useMemo(() => {
    if (!productNameSearch.trim()) return []
    const searchLower = productNameSearch.toLowerCase()
    return filteredProductNames
      .filter(name => name.toLowerCase().includes(searchLower))
      .slice(0, 20) // Limit to 20 results for performance
  }, [productNameSearch, filteredProductNames])

  // Filter States based on search
  const searchedStates = useMemo(() => {
    if (!stateSearch.trim()) return availableStates || []
    const searchLower = stateSearch.toLowerCase()
    return (availableStates || [])
      .filter(state => state.toLowerCase().includes(searchLower))
  }, [stateSearch, availableStates])

  // Filter Couriers based on search
  const searchedCouriers = useMemo(() => {
    if (!courierSearch.trim()) return availableCouriers || []
    const searchLower = courierSearch.toLowerCase()
    return (availableCouriers || [])
      .filter(courier => courier.toLowerCase().includes(searchLower))
  }, [courierSearch, availableCouriers])

  // Filter NDR Descriptions based on search
  const searchedNdrDescriptions = useMemo(() => {
    if (!ndrDescriptionSearch.trim()) return availableNdrDescriptions || []
    const searchLower = ndrDescriptionSearch.toLowerCase()
    return (availableNdrDescriptions || [])
      .filter(desc => desc.toLowerCase().includes(searchLower))
  }, [ndrDescriptionSearch, availableNdrDescriptions])

  // Close search dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (skuSearchRef.current && !skuSearchRef.current.contains(event.target as Node)) {
        setShowSkuSearch(false)
        setSkuSearch('')
      }
      if (productNameSearchRef.current && !productNameSearchRef.current.contains(event.target as Node)) {
        setShowProductNameSearch(false)
        setProductNameSearch('')
      }
      if (stateSearchRef.current && !stateSearchRef.current.contains(event.target as Node)) {
        setShowStateSearch(false)
        setStateSearch('')
      }
      if (courierSearchRef.current && !courierSearchRef.current.contains(event.target as Node)) {
        setShowCourierSearch(false)
        setCourierSearch('')
      }
      if (ndrDescriptionSearchRef.current && !ndrDescriptionSearchRef.current.contains(event.target as Node)) {
        setShowNdrDescriptionSearch(false)
        setNdrDescriptionSearch('')
      }
    }

    if (showSkuSearch || showProductNameSearch || showStateSearch || showCourierSearch || showNdrDescriptionSearch) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showSkuSearch, showProductNameSearch, showStateSearch, showCourierSearch, showNdrDescriptionSearch])

  const handleApplyFilters = () => {
    // Validate date range before applying
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      alert('⚠️ Start date cannot be after end date. Please check your date range.')
      return
    }
    // Ensure arrays are used for all multi-select fields
    const filtersToApply = {
      ...filters,
      sku: filters.sku.length > 0 ? filters.sku : 'All',
      productName: filters.productName.length > 0 ? filters.productName : 'All',
      state: filters.state.length > 0 ? filters.state : 'All',
      courier: filters.courier.length > 0 ? filters.courier : 'All',
      ndrDescription: filters.ndrDescription && filters.ndrDescription.length > 0 ? filters.ndrDescription : 'All',
      orderStatus: Array.isArray(filters.orderStatus) && filters.orderStatus.length > 0 ? filters.orderStatus : 'All',
      paymentMethod: Array.isArray(filters.paymentMethod) && filters.paymentMethod.length > 0 ? filters.paymentMethod : 'All',
      channel: Array.isArray(filters.channel) && filters.channel.length > 0 ? filters.channel : 'All',
    }
    onFilterChange(filtersToApply)
  }

  const toggleChannel = (channel: string) => {
    const currentChannels = Array.isArray(filters.channel) ? filters.channel : []
    const newChannels = currentChannels.includes(channel)
      ? currentChannels.filter(c => c !== channel)
      : [...currentChannels, channel]

    setFilters(prev => ({
      ...prev,
      channel: newChannels,
      // Clear dependent filters
      sku: [],
      productName: []
    }))
  }

  const toggleOrderStatus = (status: string) => {
    const currentStatuses = Array.isArray(filters.orderStatus) ? filters.orderStatus : []
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status]
    setFilters(prev => ({ ...prev, orderStatus: newStatuses }))
  }

  const togglePaymentMethod = (method: string) => {
    const currentMethods = Array.isArray(filters.paymentMethod) ? filters.paymentMethod : []
    const newMethods = currentMethods.includes(method)
      ? currentMethods.filter(m => m !== method)
      : [...currentMethods, method]
    setFilters(prev => ({ ...prev, paymentMethod: newMethods }))
  }

  const toggleState = (state: string) => {
    const currentStates = selectedStates
    const newStates = currentStates.includes(state)
      ? currentStates.filter(s => s !== state)
      : [...currentStates, state]
    setFilters(prev => ({ ...prev, state: newStates }))
  }

  const toggleCourier = (courier: string) => {
    const currentCouriers = selectedCouriers
    const newCouriers = currentCouriers.includes(courier)
      ? currentCouriers.filter(c => c !== courier)
      : [...currentCouriers, courier]
    setFilters(prev => ({ ...prev, courier: newCouriers }))
  }

  const toggleNdrDescription = (desc: string) => {
    const currentDescriptions = selectedNdrDescriptions
    const newDescriptions = currentDescriptions.includes(desc)
      ? currentDescriptions.filter(d => d !== desc)
      : [...currentDescriptions, desc]
    setFilters(prev => ({ ...prev, ndrDescription: newDescriptions }))
  }

  const toggleSku = (sku: string) => {
    const currentSkus = selectedSkus
    const newSkus = currentSkus.includes(sku)
      ? currentSkus.filter(s => s !== sku)
      : [...currentSkus, sku]
    setFilters(prev => ({
      ...prev,
      sku: newSkus,
      // Clear Product Name when SKU changes (cascading filter)
      productName: []
    }))
  }

  const toggleProductName = (productName: string) => {
    const currentProducts = selectedProductNames
    const newProducts = currentProducts.includes(productName)
      ? currentProducts.filter(p => p !== productName)
      : [...currentProducts, productName]
    setFilters(prev => ({ ...prev, productName: newProducts }))
  }


  const handleDateRangeChange = (start: string | null, end: string | null) => {
    setFilters(prev => ({ ...prev, startDate: start, endDate: end }))
  }

  // Removed handlePresetChange - only "All Time" and "Custom Range" are supported now

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-4">
      <div className="flex flex-col gap-4">
        {/* Date Range */}
        <div className="flex flex-col gap-2">
          <label className="text-gray-300 text-sm font-medium">Date Range</label>
          <select
            value={isCustomRange ? 'custom' : 'all'}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                // Show custom date inputs without setting default dates
                setIsCustomRange(true)
                setFilters(prev => ({ ...prev, startDate: null, endDate: null }))
              } else {
                // All Time - clear dates
                setIsCustomRange(false)
                handleDateRangeChange(null, null)
              }
            }}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
          {isCustomRange && (
            <div className="flex flex-col gap-2">
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleDateRangeChange(e.target.value, filters.endDate)}
                placeholder="Start Date"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-xs text-center">to</span>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => handleDateRangeChange(filters.startDate, e.target.value)}
                min={filters.startDate || undefined}
                placeholder="End Date"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Order Status */}
        <div className="flex flex-col gap-2 relative" ref={orderStatusSearchRef}>
          <label className="text-gray-300 text-sm font-medium">Order Status</label>
          <div className="relative">
            <div className="w-full px-3 py-2 pr-16 bg-gray-900 border border-gray-600 rounded-md text-white text-sm flex items-center gap-2">
              <span className="truncate">
                {(Array.isArray(filters.orderStatus) ? filters.orderStatus : []).length === 0 ? 'All' : `${(Array.isArray(filters.orderStatus) ? filters.orderStatus : []).length} selected`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowOrderStatusSearch(!showOrderStatusSearch)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-800 rounded"
              title="Search and select order statuses"
            >
              Search
            </button>
            {showOrderStatusSearch && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-600 rounded-md shadow-lg w-full max-w-[calc(100vw-2rem)] lg:max-w-[350px]">
                <div className="p-2 border-b border-gray-600">
                  <input
                    type="text"
                    value={orderStatusSearch}
                    onChange={(e) => setOrderStatusSearch(e.target.value)}
                    placeholder="Search statuses..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  {(Array.isArray(filters.orderStatus) ? filters.orderStatus : []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(Array.isArray(filters.orderStatus) ? filters.orderStatus : []).map((status) => (
                        <span
                          key={status}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded"
                        >
                          <span className="truncate max-w-[100px]">{status}</span>
                          <button
                            type="button"
                            onClick={() => toggleOrderStatus(status)}
                            className="hover:text-red-300 flex-shrink-0"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {availableStatuses
                    .filter(status => status.toLowerCase().includes(orderStatusSearch.toLowerCase()))
                    .map((status) => (
                      <label
                        key={status}
                        className="flex items-center gap-2 px-3 py-2 text-white text-xs hover:bg-gray-700 border-b border-gray-700 last:border-b-0 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={(Array.isArray(filters.orderStatus) ? filters.orderStatus : []).includes(status)}
                          onChange={() => toggleOrderStatus(status)}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 flex-shrink-0"
                        />
                        <span className="flex-1">{status}</span>
                      </label>
                    ))}
                  {availableStatuses.length === 0 && (
                    <div className="px-3 py-2 text-gray-400 text-xs">No statuses found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Method */}
        <div className="flex flex-col gap-2 relative" ref={paymentMethodSearchRef}>
          <label className="text-gray-300 text-sm font-medium">Payment Method</label>
          <div className="relative">
            <div className="w-full px-3 py-2 pr-16 bg-gray-900 border border-gray-600 rounded-md text-white text-sm flex items-center gap-2">
              <span className="truncate">
                {(Array.isArray(filters.paymentMethod) ? filters.paymentMethod : []).length === 0 ? 'All' : `${(Array.isArray(filters.paymentMethod) ? filters.paymentMethod : []).length} selected`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPaymentMethodSearch(!showPaymentMethodSearch)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-800 rounded"
              title="Search and select payment methods"
            >
              Search
            </button>
            {showPaymentMethodSearch && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-600 rounded-md shadow-lg w-full max-w-[calc(100vw-2rem)] lg:max-w-[350px]">
                <div className="p-2 border-b border-gray-600">
                  <input
                    type="text"
                    value={paymentMethodSearch}
                    onChange={(e) => setPaymentMethodSearch(e.target.value)}
                    placeholder="Search payment methods..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  {(Array.isArray(filters.paymentMethod) ? filters.paymentMethod : []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(Array.isArray(filters.paymentMethod) ? filters.paymentMethod : []).map((method) => (
                        <span
                          key={method}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded"
                        >
                          <span className="truncate max-w-[100px]">{method}</span>
                          <button
                            type="button"
                            onClick={() => togglePaymentMethod(method)}
                            className="hover:text-red-300 flex-shrink-0"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {availablePaymentMethods
                    .filter(method => method.toLowerCase().includes(paymentMethodSearch.toLowerCase()))
                    .map((method) => (
                      <label
                        key={method}
                        className="flex items-center gap-2 px-3 py-2 text-white text-xs hover:bg-gray-700 border-b border-gray-700 last:border-b-0 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={(Array.isArray(filters.paymentMethod) ? filters.paymentMethod : []).includes(method)}
                          onChange={() => togglePaymentMethod(method)}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 flex-shrink-0"
                        />
                        <span className="flex-1">{method}</span>
                      </label>
                    ))}
                  {availablePaymentMethods.length === 0 && (
                    <div className="px-3 py-2 text-gray-400 text-xs">No payment methods found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Channel */}
        <div className="flex flex-col gap-2 relative" ref={channelSearchRef}>
          <label className="text-gray-300 text-sm font-medium">Channel</label>
          <div className="relative">
            <div className="w-full px-3 py-2 pr-16 bg-gray-900 border border-gray-600 rounded-md text-white text-sm flex items-center gap-2">
              <span className="truncate">
                {(Array.isArray(filters.channel) ? filters.channel : []).length === 0 ? 'All' : `${(Array.isArray(filters.channel) ? filters.channel : []).length} selected`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowChannelSearch(!showChannelSearch)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-800 rounded"
              title="Search and select channels"
            >
              Search
            </button>
            {showChannelSearch && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-600 rounded-md shadow-lg w-full max-w-[calc(100vw-2rem)] lg:max-w-[350px]">
                <div className="p-2 border-b border-gray-600">
                  <input
                    type="text"
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    placeholder="Search channels..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  {(Array.isArray(filters.channel) ? filters.channel : []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(Array.isArray(filters.channel) ? filters.channel : []).map((channel) => (
                        <span
                          key={channel}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded"
                        >
                          <span className="truncate max-w-[100px]">{channel}</span>
                          <button
                            type="button"
                            onClick={() => toggleChannel(channel)}
                            className="hover:text-red-300 flex-shrink-0"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {availableChannels
                    .filter(channel => channel.toLowerCase().includes(channelSearch.toLowerCase()))
                    .map((channel) => (
                      <label
                        key={channel}
                        className="flex items-center gap-2 px-3 py-2 text-white text-xs hover:bg-gray-700 border-b border-gray-700 last:border-b-0 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={(Array.isArray(filters.channel) ? filters.channel : []).includes(channel)}
                          onChange={() => toggleChannel(channel)}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 flex-shrink-0"
                        />
                        <span className="flex-1">{channel}</span>
                      </label>
                    ))}
                  {availableChannels.length === 0 && (
                    <div className="px-3 py-2 text-gray-400 text-xs">No channels found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* State */}
        <div className="flex flex-col gap-2 relative" ref={stateSearchRef}>
          <label className="text-gray-300 text-sm font-medium">State</label>
          <div className="relative">
            <div className="w-full px-3 py-2 pr-16 bg-gray-900 border border-gray-600 rounded-md text-white text-sm flex items-center gap-2">
              <span className="truncate">
                {selectedStates.length === 0 ? 'All' : `${selectedStates.length} selected`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowStateSearch(!showStateSearch)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-800 rounded"
              title="Search and select states"
            >
              Search
            </button>
            {showStateSearch && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-600 rounded-md shadow-lg w-full max-w-[calc(100vw-2rem)] lg:max-w-[350px]">
                <div className="p-2 border-b border-gray-600">
                  <input
                    type="text"
                    value={stateSearch}
                    onChange={(e) => setStateSearch(e.target.value)}
                    placeholder="Search states..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  {selectedStates.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedStates.map((state) => (
                        <span
                          key={state}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded"
                        >
                          <span className="truncate max-w-[100px]">{state}</span>
                          <button
                            type="button"
                            onClick={() => toggleState(state)}
                            className="hover:text-red-300 flex-shrink-0"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {searchedStates.length > 0 ? (
                    searchedStates.map((state) => (
                      <label
                        key={state}
                        className="flex items-center gap-2 px-3 py-2 text-white text-xs hover:bg-gray-700 border-b border-gray-700 last:border-b-0 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStates.includes(state)}
                          onChange={() => toggleState(state)}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 flex-shrink-0"
                        />
                        <span className="flex-1">{state}</span>
                      </label>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-gray-400 text-xs">No states found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Courier */}
        <div className="flex flex-col gap-2 relative" ref={courierSearchRef}>
          <label className="text-gray-300 text-sm font-medium">Delivery Partner</label>
          <div className="relative">
            <div className="w-full px-3 py-2 pr-16 bg-gray-900 border border-gray-600 rounded-md text-white text-sm flex items-center gap-2">
              <span className="truncate">
                {selectedCouriers.length === 0 ? 'All' : `${selectedCouriers.length} selected`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowCourierSearch(!showCourierSearch)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-800 rounded"
              title="Search and select delivery partners"
            >
              Search
            </button>
            {showCourierSearch && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-600 rounded-md shadow-lg w-full max-w-[calc(100vw-2rem)] lg:max-w-[350px]">
                <div className="p-2 border-b border-gray-600">
                  <input
                    type="text"
                    value={courierSearch}
                    onChange={(e) => setCourierSearch(e.target.value)}
                    placeholder="Search delivery partners..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  {selectedCouriers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedCouriers.map((courier) => (
                        <span
                          key={courier}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded"
                        >
                          <span className="truncate max-w-[100px]">{courier}</span>
                          <button
                            type="button"
                            onClick={() => toggleCourier(courier)}
                            className="hover:text-red-300 flex-shrink-0"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {searchedCouriers.length > 0 ? (
                    searchedCouriers.map((courier) => (
                      <label
                        key={courier}
                        className="flex items-center gap-2 px-3 py-2 text-white text-xs hover:bg-gray-700 border-b border-gray-700 last:border-b-0 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCouriers.includes(courier)}
                          onChange={() => toggleCourier(courier)}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 flex-shrink-0"
                        />
                        <span className="flex-1">{courier}</span>
                      </label>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-gray-400 text-xs">No delivery partners found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* NDR Description */}
        <div className="flex flex-col gap-2 relative" ref={ndrDescriptionSearchRef}>
          <label className="text-gray-300 text-sm font-medium">NDR Description</label>
          <div className="relative">
            <div className="w-full px-3 py-2 pr-16 bg-gray-900 border border-gray-600 rounded-md text-white text-sm flex items-center gap-2">
              <span className="truncate">
                {selectedNdrDescriptions.length === 0 ? 'All' : `${selectedNdrDescriptions.length} selected`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowNdrDescriptionSearch(!showNdrDescriptionSearch)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-800 rounded"
              title="Search and select NDR descriptions"
            >
              Search
            </button>
            {showNdrDescriptionSearch && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-600 rounded-md shadow-lg w-full max-w-[calc(100vw-2rem)] lg:max-w-[350px]">
                <div className="p-2 border-b border-gray-600">
                  <input
                    type="text"
                    value={ndrDescriptionSearch}
                    onChange={(e) => setNdrDescriptionSearch(e.target.value)}
                    placeholder="Search NDR descriptions..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  {selectedNdrDescriptions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedNdrDescriptions.map((desc) => (
                        <span
                          key={desc}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded"
                        >
                          <span className="truncate max-w-[100px]">{desc}</span>
                          <button
                            type="button"
                            onClick={() => toggleNdrDescription(desc)}
                            className="hover:text-red-300 flex-shrink-0"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {searchedNdrDescriptions.length > 0 ? (
                    searchedNdrDescriptions.map((desc) => (
                      <label
                        key={desc}
                        className="flex items-center gap-2 px-3 py-2 text-white text-xs hover:bg-gray-700 border-b border-gray-700 last:border-b-0 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedNdrDescriptions.includes(desc)}
                          onChange={() => toggleNdrDescription(desc)}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 flex-shrink-0"
                        />
                        <span className="flex-1">{desc}</span>
                      </label>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-gray-400 text-xs">No NDR descriptions found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SKU */}
        <div className="flex flex-col gap-2 relative" ref={skuSearchRef}>
          <label className="text-gray-300 text-sm font-medium">SKU</label>
          <div className="relative">
            <div className="w-full px-3 py-2 pr-16 bg-gray-900 border border-gray-600 rounded-md text-white text-sm flex items-center gap-2">
              <span className="truncate">
                {selectedSkus.length === 0 ? 'All' : `${selectedSkus.length} selected`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSkuSearch(!showSkuSearch)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-800 rounded"
              title="Search and select SKUs"
            >
              Search
            </button>
            {showSkuSearch && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-600 rounded-md shadow-lg w-full max-w-[calc(100vw-2rem)] lg:max-w-[350px]">
                <div className="p-2 border-b border-gray-600">
                  <input
                    type="text"
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                    placeholder="Search SKUs..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  {selectedSkus.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedSkus.map((sku) => (
                        <span
                          key={sku}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded"
                        >
                          {sku}
                          <button
                            type="button"
                            onClick={() => toggleSku(sku)}
                            className="hover:text-red-300"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {skuSearch.trim() ? (
                    // Show search results
                    searchedSkus.length > 0 ? (
                      searchedSkus.map((sku) => (
                        <label
                          key={sku}
                          className="flex items-center gap-2 px-3 py-2 text-white text-xs hover:bg-gray-700 border-b border-gray-700 last:border-b-0 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSkus.includes(sku)}
                            onChange={() => toggleSku(sku)}
                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                          />
                          <span className="flex-1">{sku}</span>
                        </label>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-gray-400 text-xs">No SKUs found</div>
                    )
                  ) : (
                    // Show top 10 when no search query
                    filteredSkusTop10 && filteredSkusTop10.length > 0 ? (
                      <>
                        <div className="px-3 py-2 text-gray-400 text-xs font-semibold border-b border-gray-600">
                          {filters.channel && filters.channel !== 'All' ? `Top 10 SKUs (${filters.channel})` : 'Top 10 SKUs'}
                        </div>
                        {filteredSkusTop10.map((sku) => (
                          <label
                            key={sku}
                            className="flex items-center gap-2 px-3 py-2 text-white text-xs hover:bg-gray-700 border-b border-gray-700 last:border-b-0 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSkus.includes(sku)}
                              onChange={() => toggleSku(sku)}
                              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <span className="flex-1">{sku}</span>
                          </label>
                        ))}
                      </>
                    ) : (
                      <div className="px-3 py-2 text-gray-400 text-xs">Start typing to search...</div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Product Name */}
        <div className="flex flex-col gap-2 relative" ref={productNameSearchRef}>
          <label className="text-gray-300 text-sm font-medium">Product Name</label>
          <div className="relative">
            <div className="w-full px-3 py-2 pr-16 bg-gray-900 border border-gray-600 rounded-md text-white text-sm flex items-center gap-2">
              <span className="truncate">
                {selectedProductNames.length === 0 ? 'All' : `${selectedProductNames.length} selected`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowProductNameSearch(!showProductNameSearch)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-800 rounded"
              title="Search and select products"
            >
              Search
            </button>
            {showProductNameSearch && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-600 rounded-md shadow-lg w-full max-w-[calc(100vw-2rem)] lg:max-w-[350px]">
                <div className="p-2 border-b border-gray-600">
                  <input
                    type="text"
                    value={productNameSearch}
                    onChange={(e) => setProductNameSearch(e.target.value)}
                    placeholder="Search products..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  {selectedProductNames.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedProductNames.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded max-w-[200px]"
                        >
                          <span className="truncate">{name}</span>
                          <button
                            type="button"
                            onClick={() => toggleProductName(name)}
                            className="hover:text-red-300 flex-shrink-0"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {productNameSearch.trim() ? (
                    // Show search results
                    searchedProductNames.length > 0 ? (
                      searchedProductNames.map((name) => (
                        <label
                          key={name}
                          className="flex items-center gap-2 px-3 py-2 text-white text-xs hover:bg-gray-700 border-b border-gray-700 last:border-b-0 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedProductNames.includes(name)}
                            onChange={() => toggleProductName(name)}
                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 flex-shrink-0"
                          />
                          <span className="flex-1">{name}</span>
                        </label>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-gray-400 text-xs">No products found</div>
                    )
                  ) : (
                    // Show top 10 when no search query
                    filteredProductNamesTop10 && filteredProductNamesTop10.length > 0 ? (
                      <>
                        <div className="px-3 py-2 text-gray-400 text-xs font-semibold border-b border-gray-600">
                          {selectedSkus.length > 0 ? `Top 10 Products (${selectedSkus[0]})` : 'Top 10 Products'}
                        </div>
                        {filteredProductNamesTop10.map((name) => (
                          <label
                            key={name}
                            className="flex items-center gap-2 px-3 py-2 text-white text-xs hover:bg-gray-700 border-b border-gray-700 last:border-b-0 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedProductNames.includes(name)}
                              onChange={() => toggleProductName(name)}
                              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 flex-shrink-0"
                            />
                            <span className="flex-1">{name}</span>
                          </label>
                        ))}
                      </>
                    ) : (
                      <div className="px-3 py-2 text-gray-400 text-xs">Start typing to search...</div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={handleApplyFilters}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Apply Filters
          </button>

          <button
            onClick={() => {
              setFilters({
                startDate: null,
                endDate: null,
                orderStatus: 'All',
                paymentMethod: 'All',
                channel: 'All',
                state: [],
                courier: [],
                sku: [],
                productName: [],
                ndrDescription: [],

              })
              setIsCustomRange(false)
              setSkuSearch('')
              setProductNameSearch('')
              setStateSearch('')
              setCourierSearch('')
              setNdrDescriptionSearch('')
              setShowSkuSearch(false)
              setShowProductNameSearch(false)
              setShowStateSearch(false)
              setShowCourierSearch(false)
              setShowNdrDescriptionSearch(false)
              // Apply cleared filters immediately
              onFilterChange({
                startDate: null,
                endDate: null,
                orderStatus: 'All',
                paymentMethod: 'All',
                channel: 'All',
                state: [],
                courier: [],
                sku: [],
                productName: [],
                ndrDescription: [],

              })
            }}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
    </div >
  )
}
