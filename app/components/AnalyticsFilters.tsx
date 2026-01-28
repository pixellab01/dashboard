'use client'

import { useState, useMemo, useEffect, useRef } from 'react'

export interface FilterState {
  startDate: string | null
  endDate: string | null
  orderStatus: string
  paymentMethod: string
  channel: string
  sku: string[] | string
  productName: string[] | string
}

interface AnalyticsFiltersProps {
  onFilterChange: (filters: FilterState) => void
  availableChannels: string[]
  availableSkus: string[]
  availableSkusTop10: string[]
  availableProductNames: string[]
  availableProductNamesTop10: string[]
  availableStatuses: string[]
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
  sessionId,
  onFilterOptionsChange,
}: AnalyticsFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    startDate: null,
    endDate: null,
    orderStatus: 'All',
    paymentMethod: 'All',
    channel: 'All',
    sku: [],
    productName: [],
  })
  
  const [isCustomRange, setIsCustomRange] = useState(false)
  const [skuSearch, setSkuSearch] = useState('')
  const [productNameSearch, setProductNameSearch] = useState('')
  const [showSkuSearch, setShowSkuSearch] = useState(false)
  const [showProductNameSearch, setShowProductNameSearch] = useState(false)
  const skuSearchRef = useRef<HTMLDivElement>(null)
  const productNameSearchRef = useRef<HTMLDivElement>(null)
  
  // Cascading filter options - filtered based on channel/SKU selection
  const [filteredSkus, setFilteredSkus] = useState<string[]>(availableSkus)
  const [filteredSkusTop10, setFilteredSkusTop10] = useState<string[]>(availableSkusTop10)
  const [filteredProductNames, setFilteredProductNames] = useState<string[]>(availableProductNames)
  const [filteredProductNamesTop10, setFilteredProductNamesTop10] = useState<string[]>(availableProductNamesTop10)

  // Helper to get selected SKUs as array
  const selectedSkus = Array.isArray(filters.sku) ? filters.sku : (filters.sku === 'All' || !filters.sku ? [] : [filters.sku])
  
  // Helper to get selected Product Names as array
  const selectedProductNames = Array.isArray(filters.productName) ? filters.productName : (filters.productName === 'All' || !filters.productName ? [] : [filters.productName])

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
        if (filters.channel && filters.channel !== 'All') {
          params.append('channel', filters.channel)
        }
        if (selectedSkus.length > 0 && selectedSkus[0]) {
          params.append('sku', selectedSkus[0]) // Use first selected SKU for filtering
        }
        
        const response = await fetch(`/api/analytics/filter-options?${params.toString()}`)
        const data = await response.json()
        
        if (data.success) {
          // Update SKU options if channel is selected
          if (filters.channel && filters.channel !== 'All') {
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
          if (filters.channel && filters.channel !== 'All') {
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
  }, [sessionId, filters.channel, selectedSkus.join(','), availableSkus, availableSkusTop10, availableProductNames, availableProductNamesTop10, selectedProductNames.length])

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
    }

    if (showSkuSearch || showProductNameSearch) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showSkuSearch, showProductNameSearch])

  const handleApplyFilters = () => {
    // Validate date range before applying
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      alert('⚠️ Start date cannot be after end date. Please check your date range.')
      return
    }
    // Ensure arrays are used for sku and productName
    const filtersToApply = {
      ...filters,
      sku: selectedSkus.length > 0 ? selectedSkus : 'All',
      productName: selectedProductNames.length > 0 ? selectedProductNames : 'All',
    }
    onFilterChange(filtersToApply)
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
        <div className="flex flex-col gap-2">
          <label className="text-gray-300 text-sm font-medium">Order Status</label>
          <select
            value={filters.orderStatus}
            onChange={(e) => setFilters(prev => ({ ...prev, orderStatus: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            title={availableStatuses.length > 0 ? `Available statuses: ${availableStatuses.join(', ')}` : 'Select status'}
          >
            <option value="All">All</option>
            {availableStatuses.length > 0 ? (
              // Use the predefined status list from API
              availableStatuses.map((status) => {
                // Map status values to display-friendly names
                // Keep the original status value for filtering, but show friendly name
                const statusStr = String(status).trim()
                const statusUpper = statusStr.toUpperCase()
                
                // Create display name mapping
                const displayNameMap: Record<string, string> = {
                  'CANCELED': 'Canceled',
                  'DELIVERED': 'Delivered',
                  'DESTROYED': 'Destroyed',
                  'IN TRANSIT': 'In Transit',
                  'IN TRANSIT-AT DESTINATION HUB': 'In Transit - At Destination Hub',
                  'LOST': 'Lost',
                  'OUT FOR DELIVERY': 'Out for Delivery',
                  'OUT FOR PICKUP': 'Out for Pickup',
                  'PICKED UP': 'Picked Up',
                  'PICKUP EXCEPTION': 'Pickup Exception',
                  'REACHED BACK AT_SELLER_CITY': 'Reached Back at Seller City',
                  'REACHED DESTINATION HUB': 'Reached Destination Hub',
                  'RTO DELIVERED': 'RTO Delivered',
                  'RTO IN TRANSIT': 'RTO In Transit',
                  'RTO INITIATED': 'RTO Initiated',
                  'RTO NDR': 'RTO NDR',
                  'UNDELIVERED': 'Undelivered',
                  'UNDELIVERED-1ST ATTEMPT': 'Undelivered - 1st Attempt',
                  'UNDELIVERED-2ND ATTEMPT': 'Undelivered - 2nd Attempt',
                  'UNDELIVERED-3RD ATTEMPT': 'Undelivered - 3rd Attempt',
                  'UNTRACEABLE': 'Untraceable'
                }
                
                const displayName = displayNameMap[statusUpper] || statusStr
                
                return (
                  <option key={status} value={statusStr}>
                    {displayName}
                  </option>
                )
              })
            ) : (
              // Fallback to predefined statuses if API doesn't return them
              <>
                <option value="CANCELED">Canceled</option>
                <option value="DELIVERED">Delivered</option>
                <option value="DESTROYED">Destroyed</option>
                <option value="IN TRANSIT">In Transit</option>
                <option value="IN TRANSIT-AT DESTINATION HUB">In Transit - At Destination Hub</option>
                <option value="LOST">Lost</option>
                <option value="OUT FOR DELIVERY">Out for Delivery</option>
                <option value="OUT FOR PICKUP">Out for Pickup</option>
                <option value="PICKED UP">Picked Up</option>
                <option value="PICKUP EXCEPTION">Pickup Exception</option>
                <option value="REACHED BACK AT_SELLER_CITY">Reached Back at Seller City</option>
                <option value="REACHED DESTINATION HUB">Reached Destination Hub</option>
                <option value="RTO DELIVERED">RTO Delivered</option>
                <option value="RTO IN TRANSIT">RTO In Transit</option>
                <option value="RTO INITIATED">RTO Initiated</option>
                <option value="RTO NDR">RTO NDR</option>
                <option value="UNDELIVERED">Undelivered</option>
                <option value="UNDELIVERED-1st Attempt">Undelivered - 1st Attempt</option>
                <option value="UNDELIVERED-2nd Attempt">Undelivered - 2nd Attempt</option>
                <option value="UNDELIVERED-3rd Attempt">Undelivered - 3rd Attempt</option>
                <option value="UNTRACEABLE">Untraceable</option>
              </>
            )}
          </select>
        </div>

        {/* Payment Method */}
        <div className="flex flex-col gap-2">
          <label className="text-gray-300 text-sm font-medium">Payment Method</label>
          <select
            value={filters.paymentMethod}
            onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All</option>
            <option value="COD">COD</option>
            <option value="Online">Online</option>
            <option value="NaN">NaN</option>
          </select>
        </div>

        {/* Channel */}
        <div className="flex flex-col gap-2">
          <label className="text-gray-300 text-sm font-medium">Channel</label>
          <select
            value={filters.channel}
            onChange={(e) => {
              setFilters(prev => ({ 
                ...prev, 
                channel: e.target.value,
                // Clear SKU and Product Name when channel changes (cascading filter)
                sku: [],
                productName: []
              }))
            }}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All</option>
            {availableChannels.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
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
                sku: [],
                productName: [],
              })
              setIsCustomRange(false)
              setSkuSearch('')
              setProductNameSearch('')
              setShowSkuSearch(false)
              setShowProductNameSearch(false)
              // Apply cleared filters immediately
              onFilterChange({
                startDate: null,
                endDate: null,
                orderStatus: 'All',
                paymentMethod: 'All',
                channel: 'All',
                sku: [],
                productName: [],
              })
            }}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  )
}
