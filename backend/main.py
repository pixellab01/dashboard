"""
FastAPI Application for Analytics Dashboard
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import uvicorn

from backend.analytics import compute_all_analytics, filter_shipping_data, compute_single_analytics
from backend.data_store import get_shipping_data, get_shipping_metadata
import pandas as pd
import uuid

# Import API routers
from backend.api import auth, google_drive, admin, stats

app = FastAPI(title="Analytics Dashboard API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth.router)
app.include_router(google_drive.router)
app.include_router(admin.router)
app.include_router(stats.router)


# Request/Response Models
class ComputeAnalyticsRequest(BaseModel):
    sessionId: str
    filters: Optional[Dict[str, Any]] = None


class FilterParams(BaseModel):
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    orderStatus: Optional[str] = None
    paymentMethod: Optional[str] = None
    channel: Optional[str] = None
    sku: Optional[List[str]] = None
    productName: Optional[List[str]] = None


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Analytics Dashboard API"}


@app.post("/api/analytics/compute")
async def compute_analytics(request: ComputeAnalyticsRequest):
    """
    POST /api/analytics/compute
    Compute analytics from stored data
    """
    try:
        if not request.sessionId:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        # Get data from in-memory store
        data = get_shipping_data(request.sessionId)
        if not data:
            raise HTTPException(
                status_code=404,
                detail=f"No data found for session {request.sessionId}. Please read the shipping file first."
            )
        
        # Compute analytics WITH session_id for caching
        result = compute_all_analytics(data, request.filters, request.sessionId)
        
        if not result.get('success'):
            raise HTTPException(
                status_code=500,
                detail=result.get('error', 'Failed to compute analytics')
            )
        
        return {
            "success": True,
            "message": "Analytics computed successfully",
            "sessionId": request.sessionId,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error computing analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Specific routes must be defined BEFORE the generic route to avoid conflicts
@app.get("/api/analytics/filter-options")
async def get_filter_options(sessionId: str, channel: Optional[str] = None, sku: Optional[str] = None):
    """Get filter options (channels, SKUs, product names, statuses)"""
    try:
        if not sessionId:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        # CHECK CACHE FIRST
        from backend.data_store import get_analytics
        filter_filters = {}
        if channel:
            filter_filters['channel'] = channel
        if sku:
            filter_filters['sku'] = sku
        cached_result = get_analytics(sessionId, 'filter-options', filter_filters if filter_filters else None)
        
        if cached_result is not None:
            print(f"✅ Using cached filter-options for session {sessionId}")
            return cached_result
        
        # Get cached DataFrame if available
        from backend.data_store import get_dataframe
        df = get_dataframe(sessionId)
        
        if df is None:
            # Fallback to data conversion
            data = get_shipping_data(sessionId)
            if not data or len(data) == 0:
                raise HTTPException(
                    status_code=404, 
                    detail=f"No data found for session {sessionId}. The server may have restarted and cleared the in-memory store. Please read the shipping file again."
                )
            df = pd.DataFrame(data)
            # Cache it for next time
            from backend.data_store import store_dataframe
            store_dataframe(sessionId, df)
        else:
            print(f"✅ Using cached DataFrame for filter-options")
        
        # Debug: Print available columns for SKU detection
        print(f"📋 Available columns for filter-options (first 30): {df.columns.tolist()[:30]}")
        
        # Apply channel filter if provided
        if channel and channel != 'All':
            channel_col = None
            # Check multiple possible column name variations
            for col in ['channel', 'Channel', 'channel__', 'Channel__', 'sales_channel', 'Sales Channel']:
                if col in df.columns:
                    channel_col = col
                    break
            if channel_col:
                # Try exact match first, then case-insensitive match
                filtered_df = df[df[channel_col].astype(str).str.strip() == channel]
                if filtered_df.empty:
                    # Try case-insensitive match
                    filtered_df = df[df[channel_col].astype(str).str.strip().str.lower() == channel.lower()]
                df = filtered_df
                print(f"✅ Applied channel filter '{channel}' on column '{channel_col}': {len(df)} rows remaining")
            else:
                print(f"⚠️ Channel filter '{channel}' requested but no channel column found in DataFrame")
        
        # Apply SKU filter if provided
        if sku and sku != 'All':
            sku_col = None
            # Check both single and double underscore variants (after normalization)
            for col in ['master__s_k_u', 'master_s_k_u', 'master_sku', 'sku', 
                       'channel__s_k_u', 'channel_s_k_u', 'channel_sku', 'channel__sku']:
                if col in df.columns:
                    sku_col = col
                    break
            if sku_col:
                df = df[df[sku_col] == sku]
        
        # If DataFrame is empty after filtering, return empty filter options instead of 404
        # This is a valid state when filters don't match any data
        if df.empty:
            print(f"⚠️ No data found after filtering (channel={channel}, sku={sku}), returning empty filter options")
            result = {
                "success": True,
                "channels": [],
                "skus": [],
                "skusTop10": [],
                "productNames": [],
                "productNamesTop10": [],
                "statuses": sorted([
                    'CANCELED', 'DELIVERED', 'DESTROYED', 'IN TRANSIT',
                    'IN TRANSIT-AT DESTINATION HUB', 'LOST', 'OUT FOR DELIVERY',
                    'OUT FOR PICKUP', 'PICKED UP', 'PICKUP EXCEPTION',
                    'REACHED BACK AT_SELLER_CITY', 'REACHED DESTINATION HUB',
                    'RTO DELIVERED', 'RTO IN TRANSIT', 'RTO INITIATED', 'RTO NDR',
                    'UNDELIVERED', 'UNDELIVERED-1st Attempt', 'UNDELIVERED-2nd Attempt',
                    'UNDELIVERED-3rd Attempt', 'UNTRACEABLE'
                ]),
            }
            # Cache the empty result
            from backend.data_store import store_analytics
            store_analytics(sessionId, 'filter-options', result, filter_filters if filter_filters else None)
            return result
        
        # Extract unique values
        channels = set()
        sku_counts = {}
        product_name_counts = {}
        statuses = set()
        
        # Channel extraction - check both single and double underscore variants
        channel_col = None
        for col in ['channel', 'Channel', 'channel__']:
            if col in df.columns:
                channel_col = col
                break
        if channel_col:
            channels = set(df[channel_col].dropna().astype(str).unique())
            channels = {c for c in channels if c.lower() not in ['none', 'n/a', '']}
        
        # SKU extraction - check both single and double underscore variants
        sku_cols = ['master__s_k_u', 'master_s_k_u', 'master_sku', 'sku', 
                   'channel__s_k_u', 'channel_s_k_u', 'channel_sku', 'channel__sku']
        sku_col_found = None
        for col in sku_cols:
            if col in df.columns:
                sku_col_found = col
                print(f"✅ Found SKU column: {col}")
                for val in df[col].dropna().astype(str):
                    val = val.strip()
                    if val and val.lower() not in ['none', 'n/a', 'na', 'null', 'undefined', '']:
                        sku_counts[val] = sku_counts.get(val, 0) + 1
                break  # Use first found column
        
        if not sku_col_found:
            print(f"⚠️ No SKU column found! Available columns: {df.columns.tolist()[:40]}")
        else:
            print(f"✅ Extracted {len(sku_counts)} unique SKUs")
        
        # Product name extraction - check both single and double underscore variants
        product_cols = ['product__name', 'product_name', 'Product Name']
        product_col_found = None
        for col in product_cols:
            if col in df.columns:
                product_col_found = col
                print(f"✅ Found Product Name column: {col}")
                for val in df[col].dropna().astype(str):
                    val = val.strip()
                    if val and val.lower() not in ['none', 'n/a', 'na', 'null', 'undefined', '']:
                        product_name_counts[val] = product_name_counts.get(val, 0) + 1
                break  # Use first found column
        
        if not product_col_found:
            print(f"⚠️ No Product Name column found!")
        else:
            print(f"✅ Extracted {len(product_name_counts)} unique product names")
        
        # Status extraction
        status_cols = ['delivery_status', 'status', 'original_status', 'current_status']
        for col in status_cols:
            if col in df.columns:
                for val in df[col].dropna().astype(str):
                    val = val.strip().upper()
                    if val and val not in ['NONE', 'N/A', 'NA', 'NULL', 'UNDEFINED', '', "'"]:
                        statuses.add(val)
        
        # Predefined statuses
        predefined_statuses = [
            'CANCELED', 'DELIVERED', 'DESTROYED', 'IN TRANSIT',
            'IN TRANSIT-AT DESTINATION HUB', 'LOST', 'OUT FOR DELIVERY',
            'OUT FOR PICKUP', 'PICKED UP', 'PICKUP EXCEPTION',
            'REACHED BACK AT_SELLER_CITY', 'REACHED DESTINATION HUB',
            'RTO DELIVERED', 'RTO IN TRANSIT', 'RTO INITIATED', 'RTO NDR',
            'UNDELIVERED', 'UNDELIVERED-1st Attempt', 'UNDELIVERED-2nd Attempt',
            'UNDELIVERED-3rd Attempt', 'UNTRACEABLE'
        ]
        statuses.update(predefined_statuses)
        
        # Get top 10 SKUs and product names
        sku_top10 = sorted(sku_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        product_top10 = sorted(product_name_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        
        result = {
            "success": True,
            "channels": sorted(list(channels)),
            "skus": sorted(list(sku_counts.keys())),
            "skusTop10": [s[0] for s in sku_top10],
            "productNames": sorted(list(product_name_counts.keys())),
            "productNamesTop10": [p[0] for p in product_top10],
            "statuses": sorted(list(statuses)),
        }
        
        # Cache the result
        from backend.data_store import store_analytics
        store_analytics(sessionId, 'filter-options', result, filter_filters if filter_filters else None)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting filter options: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/raw-shipping")
async def get_raw_shipping(
    sessionId: str,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None,
    limit: Optional[int] = None,
    page: Optional[int] = 1
):
    """Get raw shipping data with optional filters"""
    try:
        if not sessionId:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        # Get data from in-memory store
        data = get_shipping_data(sessionId)
        if not data or len(data) == 0:
            raise HTTPException(
                status_code=404, 
                detail=f"No data found for session {sessionId}. The server may have restarted. Please read the shipping file again."
            )
        
        # Build filters dict
        filters = {}
        if startDate:
            filters['startDate'] = startDate
        if endDate:
            filters['endDate'] = endDate
        if orderStatus and orderStatus != 'All':
            filters['orderStatus'] = orderStatus
        if paymentMethod and paymentMethod != 'All':
            filters['paymentMethod'] = paymentMethod
        if channel and channel != 'All':
            filters['channel'] = channel
        if sku:
            filters['sku'] = sku
        if productName:
            filters['productName'] = productName
        
        # Apply filters if any
        if filters:
            df = pd.DataFrame(data)
            filtered_df = filter_shipping_data(df, filters)
            # Replace NaN values with None for JSON serialization
            filtered_df = filtered_df.where(pd.notna(filtered_df), None)
            filtered_data = filtered_df.to_dict('records')
        else:
            filtered_data = data
        
        # Clean NaN values in filtered_data for JSON serialization
        def clean_nan(obj):
            if isinstance(obj, dict):
                return {k: clean_nan(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [clean_nan(item) for item in obj]
            elif isinstance(obj, float) and (pd.isna(obj) or obj != obj):  # NaN check
                return None
            return obj
        
        filtered_data = clean_nan(filtered_data)
        
        # Apply pagination if limit is provided
        if limit:
            limit = min(limit, 500)  # Max 500 per page
            page = page or 1
            start_index = (page - 1) * limit
            end_index = start_index + limit
            paginated_data = filtered_data[start_index:end_index]
            total_pages = (len(filtered_data) + limit - 1) // limit
        else:
            paginated_data = filtered_data
            total_pages = 1
        
        return {
            "success": True,
            "data": paginated_data,
            "count": len(paginated_data),
            "total": len(filtered_data),
            "page": page or 1,
            "limit": limit or len(filtered_data),
            "totalPages": total_pages,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting raw shipping data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/{analytics_type}")
async def get_analytics(
    analytics_type: str, 
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """
    GET /api/analytics/{analytics_type}?sessionId=xxx&filters=xxx
    Get computed analytics from stored data
    Supports filters as JSON string or individual query parameters
    """
    try:
        if not sessionId:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        # Parse filters if provided as JSON string
        filter_dict = None
        if filters:
            import json
            try:
                filter_dict = json.loads(filters)
            except json.JSONDecodeError:
                filter_dict = None
        
        # If no filters JSON string, build filter_dict from individual query parameters
        if not filter_dict:
            filter_dict = {}
            if startDate:
                filter_dict['startDate'] = startDate
            if endDate:
                filter_dict['endDate'] = endDate
            if orderStatus and orderStatus != 'All':
                filter_dict['orderStatus'] = orderStatus
            if paymentMethod and paymentMethod != 'All':
                filter_dict['paymentMethod'] = paymentMethod
            if channel and channel != 'All':
                filter_dict['channel'] = channel
            if sku:
                filter_dict['sku'] = sku if isinstance(sku, list) else [sku]
            if productName:
                filter_dict['productName'] = productName if isinstance(productName, list) else [productName]
            
            # Only set filter_dict if it has any filters
            if not filter_dict:
                filter_dict = None
        
        # Get data from in-memory store
        data = get_shipping_data(sessionId)
        if not data:
            raise HTTPException(
                status_code=404,
                detail=f"No data found for session {sessionId}. The server may have restarted and cleared the in-memory store. Please read the shipping file again."
            )
        
        # Check if it's a special endpoint that has its own route
        if analytics_type in ['filter-options', 'raw-shipping']:
            raise HTTPException(
                status_code=404,
                detail=f"Use the dedicated endpoint for '{analytics_type}': /api/analytics/{analytics_type}"
            )
        
        # CHECK CACHE FIRST
        from backend.data_store import get_analytics
        cached_result = get_analytics(sessionId, analytics_type, filter_dict)
        
        if cached_result is not None:
            print(f"✅ Using cached analytics '{analytics_type}' for session {sessionId}")
            return cached_result  # Return in same format as compute_single_analytics
        
        # Cache miss - compute on demand
        print(f"⚠️  Cache miss for '{analytics_type}' - computing on demand...")
        computed_data = compute_single_analytics(data, analytics_type, filter_dict)
        
        if computed_data is None:
            raise HTTPException(
                status_code=404, 
                detail=f"Analytics type '{analytics_type}' is not supported or could not be computed"
            )
        
        # Store in cache for next time
        if computed_data and sessionId:
            from backend.data_store import store_analytics
            store_analytics(sessionId, analytics_type, computed_data, filter_dict)
        
        return computed_data
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting analytics: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/weekly-summary")
async def get_weekly_summary(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get weekly summary analytics"""
    return await get_analytics(
        "weekly-summary", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/ndr-weekly")
async def get_ndr_weekly(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get NDR weekly analytics"""
    return await get_analytics(
        "ndr-weekly", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/state-performance")
async def get_state_performance(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get state performance analytics"""
    return await get_analytics(
        "state-performance", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/category-share")
async def get_category_share(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get category share analytics"""
    return await get_analytics(
        "category-share", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/cancellation-tracker")
async def get_cancellation_tracker(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get cancellation tracker analytics"""
    return await get_analytics(
        "cancellation-tracker", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/channel-share")
async def get_channel_share(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get channel share analytics"""
    return await get_analytics(
        "channel-share", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/payment-method")
async def get_payment_method(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get payment method analytics"""
    return await get_analytics(
        "payment-method", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/product-analysis")
async def get_product_analysis(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get product analysis analytics"""
    return await get_analytics(
        "product-analysis", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/sku-analysis")
async def get_sku_analysis(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get SKU analysis analytics"""
    return await get_analytics(
        "sku-analysis", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/summary-metrics")
async def get_summary_metrics(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get summary metrics analytics"""
    return await get_analytics(
        "summary-metrics", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/order-statuses")
async def get_order_statuses(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get order statuses analytics"""
    return await get_analytics(
        "order-statuses", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/order-status-filter")
async def get_order_status_filter(sessionId: str):
    """Get unique order statuses for filter dropdown from dataframe"""
    try:
        if not sessionId:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        # Get data from in-memory store
        data = get_shipping_data(sessionId)
        if not data or len(data) == 0:
            raise HTTPException(
                status_code=404, 
                detail=f"No data found for session {sessionId}. The server may have restarted and cleared the in-memory store. Please read the shipping file again."
            )
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found in dataframe")
        
        # Extract unique order statuses from multiple possible columns
        statuses = set()
        status_cols = ['delivery_status', 'status', 'original_status', 'current_status']
        
        for col in status_cols:
            if col in df.columns:
                # Get unique values, convert to string, strip whitespace, and filter out invalid values
                unique_statuses = df[col].dropna().astype(str).str.strip().str.upper()
                valid_statuses = unique_statuses[
                    ~unique_statuses.isin(['NONE', 'N/A', 'NA', 'NULL', 'UNDEFINED', '', "'", 'NAN'])
                ]
                statuses.update(valid_statuses.unique())
        
        # Convert to sorted list
        status_list = sorted(list(statuses))
        
        return {
            "success": True,
            "statuses": status_list,
            "count": len(status_list)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting order status filter: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/payment-method-outcome")
async def get_payment_method_outcome(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get payment method outcome analytics"""
    return await get_analytics(
        "payment-method-outcome", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/ndr-count")
async def get_ndr_count(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get NDR count analytics"""
    return await get_analytics(
        "ndr-count", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/address-type-share")
async def get_address_type_share(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get address type share analytics"""
    return await get_analytics(
        "address-type-share", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/average-order-tat")
async def get_average_order_tat(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get average order TAT analytics"""
    return await get_analytics(
        "average-order-tat", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/fad-del-can-rto")
async def get_fad_del_can_rto(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get FAD/DEL/CAN/RTO analytics"""
    return await get_analytics(
        "fad-del-can-rto", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/cancellation-reason-tracker")
async def get_cancellation_reason_tracker(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get cancellation reason tracker analytics"""
    return await get_analytics(
        "cancellation-reason-tracker", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/analytics/delivery-partner-analysis")
async def get_delivery_partner_analysis(
    sessionId: str, 
    filters: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    orderStatus: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    channel: Optional[str] = None,
    sku: Optional[List[str]] = None,
    productName: Optional[List[str]] = None
):
    """Get delivery partner analysis analytics"""
    return await get_analytics(
        "delivery-partner-analysis", sessionId, filters,
        startDate, endDate, orderStatus, paymentMethod, channel, sku, productName
    )


@app.get("/api/stats/session")
async def get_session_stats(sessionId: str):
    """Get session statistics"""
    try:
        if not sessionId:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        return {
            "sessionId": sessionId,
            "message": "Session stats endpoint - Redis removed, data must be provided directly"
        }
    except Exception as e:
        print(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/session/generate")
async def generate_session():
    """Generate a new session ID"""
    session_id = f"session_{uuid.uuid4().hex[:16]}"
    return {"sessionId": session_id}




if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
