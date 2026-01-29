"""
FastAPI Application for Analytics Dashboard
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import uvicorn

from backend.analytics import compute_all_analytics
from backend.redis_client import (
    get_shipping_data_from_redis,
    get_analytics_from_redis,
    get_analytics_by_filters,
    get_shipping_metadata_from_redis,
    is_session_valid,
    generate_session_id,
    get_shipping_data_ttl,
    build_analytics_key,
    is_source_data_valid,
    save_analytics_to_redis,
    get_key_ttl
)
from backend.analytics import filter_shipping_data
import pandas as pd
from backend.rq_queue import enqueue_analytics_computation, get_job_status, get_queue_stats

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
async def compute_analytics(request: ComputeAnalyticsRequest, async_mode: bool = False):
    """
    POST /api/analytics/compute?async_mode=true
    Compute analytics from Redis data
    If async_mode=true, queues the job and returns immediately
    """
    try:
        if not request.sessionId:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        if async_mode:
            # Queue the job for async processing
            job = enqueue_analytics_computation(request.sessionId, request.filters)
            return {
                "success": True,
                "message": "Analytics computation queued",
                "sessionId": request.sessionId,
                "jobId": job.id if job else None,
            }
        else:
            # Compute synchronously
            result = compute_all_analytics(request.sessionId, request.filters)
            
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


@app.get("/api/analytics/{analytics_type}")
async def get_analytics(analytics_type: str, sessionId: str, filters: Optional[str] = None):
    """
    GET /api/analytics/{analytics_type}?sessionId=xxx&filters=xxx
    Get computed analytics from Redis
    """
    try:
        if not sessionId:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        # Parse filters if provided
        filter_dict = None
        if filters:
            import json
            filter_dict = json.loads(filters)
        
        # Get analytics
        if filter_dict:
            analytics_data = get_analytics_by_filters(sessionId, analytics_type, filter_dict)
        else:
            analytics_data = get_analytics_from_redis(sessionId, analytics_type)
        
        if analytics_data is None:
            raise HTTPException(status_code=404, detail="Analytics not found")
        
        return analytics_data
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/weekly-summary")
async def get_weekly_summary(sessionId: str, filters: Optional[str] = None):
    """Get weekly summary analytics"""
    return await get_analytics("weekly-summary", sessionId, filters)


@app.get("/api/analytics/ndr-weekly")
async def get_ndr_weekly(sessionId: str, filters: Optional[str] = None):
    """Get NDR weekly analytics"""
    return await get_analytics("ndr-weekly", sessionId, filters)


@app.get("/api/analytics/state-performance")
async def get_state_performance(sessionId: str, filters: Optional[str] = None):
    """Get state performance analytics"""
    return await get_analytics("state-performance", sessionId, filters)


@app.get("/api/analytics/category-share")
async def get_category_share(sessionId: str, filters: Optional[str] = None):
    """Get category share analytics"""
    return await get_analytics("category-share", sessionId, filters)


@app.get("/api/analytics/cancellation-tracker")
async def get_cancellation_tracker(sessionId: str, filters: Optional[str] = None):
    """Get cancellation tracker analytics"""
    return await get_analytics("cancellation-tracker", sessionId, filters)


@app.get("/api/analytics/channel-share")
async def get_channel_share(sessionId: str, filters: Optional[str] = None):
    """Get channel share analytics"""
    return await get_analytics("channel-share", sessionId, filters)


@app.get("/api/analytics/payment-method")
async def get_payment_method(sessionId: str, filters: Optional[str] = None):
    """Get payment method analytics"""
    return await get_analytics("payment-method", sessionId, filters)


@app.get("/api/analytics/product-analysis")
async def get_product_analysis(sessionId: str, filters: Optional[str] = None):
    """Get product analysis analytics"""
    return await get_analytics("product-analysis", sessionId, filters)


@app.get("/api/analytics/summary-metrics")
async def get_summary_metrics(sessionId: str, filters: Optional[str] = None):
    """Get summary metrics analytics"""
    return await get_analytics("summary-metrics", sessionId, filters)


@app.get("/api/analytics/order-statuses")
async def get_order_statuses(sessionId: str, filters: Optional[str] = None):
    """Get order statuses analytics"""
    return await get_analytics("order-statuses", sessionId, filters)


@app.get("/api/analytics/payment-method-outcome")
async def get_payment_method_outcome(sessionId: str, filters: Optional[str] = None):
    """Get payment method outcome analytics"""
    return await get_analytics("payment-method-outcome", sessionId, filters)


@app.get("/api/stats/session")
async def get_session_stats(sessionId: str):
    """Get session statistics"""
    try:
        if not sessionId:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        metadata = get_shipping_metadata_from_redis(sessionId)
        ttl = get_shipping_data_ttl(sessionId)
        is_valid = is_session_valid(sessionId)
        
        return {
            "sessionId": sessionId,
            "isValid": is_valid,
            "ttl": ttl,
            "metadata": metadata,
        }
    except Exception as e:
        print(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/session/generate")
async def generate_session():
    """Generate a new session ID"""
    session_id = generate_session_id()
    return {"sessionId": session_id}


@app.get("/api/analytics/filter-options")
async def get_filter_options(sessionId: str, channel: Optional[str] = None, sku: Optional[str] = None):
    """Get filter options (channels, SKUs, product names, statuses)"""
    try:
        if not sessionId:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        # Check if source data is valid
        if not is_source_data_valid(sessionId):
            return {
                "success": False,
                "error": "Source data has expired. Please read the shipping file again."
            }
        
        # Build cache key
        cache_key = f"filter-options:{channel or 'all'}:{sku or 'all'}"
        
        # Try to get from cache
        cached_result = get_analytics_from_redis(sessionId, cache_key)
        if cached_result:
            return cached_result
        
        # Get data from Redis
        data = get_shipping_data_from_redis(sessionId)
        if not data or len(data) == 0:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Convert to DataFrame for easier filtering
        df = pd.DataFrame(data)
        
        # Apply channel filter if provided
        if channel and channel != 'All':
            channel_col = None
            for col in ['channel', 'Channel', 'channel__']:
                if col in df.columns:
                    channel_col = col
                    break
            if channel_col:
                df = df[df[channel_col] == channel]
        
        # Apply SKU filter if provided
        if sku and sku != 'All':
            sku_col = None
            for col in ['master_s_k_u', 'master_sku', 'sku', 'channel_s_k_u', 'channel_sku']:
                if col in df.columns:
                    sku_col = col
                    break
            if sku_col:
                df = df[df[sku_col] == sku]
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found after filtering")
        
        # Extract unique values
        channels = set()
        sku_counts = {}
        product_name_counts = {}
        statuses = set()
        
        # Channel extraction
        channel_col = None
        for col in ['channel', 'Channel', 'channel__']:
            if col in df.columns:
                channel_col = col
                break
        if channel_col:
            channels = set(df[channel_col].dropna().astype(str).unique())
            channels = {c for c in channels if c.lower() not in ['none', 'n/a', '']}
        
        # SKU extraction
        sku_cols = ['master_s_k_u', 'master_sku', 'sku', 'channel_s_k_u', 'channel_sku']
        for col in sku_cols:
            if col in df.columns:
                for val in df[col].dropna().astype(str):
                    val = val.strip()
                    if val and val.lower() not in ['none', 'n/a', 'na', 'null', 'undefined', '']:
                        sku_counts[val] = sku_counts.get(val, 0) + 1
        
        # Product name extraction
        product_cols = ['product_name', 'product__name', 'Product Name']
        for col in product_cols:
            if col in df.columns:
                for val in df[col].dropna().astype(str):
                    val = val.strip()
                    if val and val.lower() not in ['none', 'n/a', 'na', 'null', 'undefined', '']:
                        product_name_counts[val] = product_name_counts.get(val, 0) + 1
        
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
        save_analytics_to_redis(sessionId, cache_key, result)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting filter options: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/ttl-info")
async def get_ttl_info(sessionId: str):
    """Get TTL information for shipping data and analytics"""
    try:
        if not sessionId:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        # Get shipping data TTL
        shipping_ttl = get_shipping_data_ttl(sessionId)
        shipping_expires_at = None
        if shipping_ttl > 0:
            from datetime import datetime, timedelta
            shipping_expires_at = (datetime.now() + timedelta(seconds=shipping_ttl)).isoformat()
        
        # Get analytics TTLs
        analytics_types = [
            'weekly-summary', 'ndr-weekly', 'state-performance',
            'category-share', 'cancellation-tracker', 'channel-share',
            'payment-method', 'product-analysis'
        ]
        
        analytics_ttls = {}
        for analytics_type in analytics_types:
            key = build_analytics_key(sessionId, analytics_type, None)
            ttl = get_key_ttl(key)
            expires_at = None
            if ttl > 0:
                from datetime import datetime, timedelta
                expires_at = (datetime.now() + timedelta(seconds=ttl)).isoformat()
            analytics_ttls[analytics_type] = {
                "ttl": ttl,
                "expiresAt": expires_at
            }
        
        return {
            "shipping": {
                "ttl": shipping_ttl,
                "expiresAt": shipping_expires_at
            },
            "analytics": analytics_ttls
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting TTL info: {e}")
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
        
        # Get data from Redis
        data = get_shipping_data_from_redis(sessionId)
        if not data or len(data) == 0:
            raise HTTPException(status_code=404, detail="No data found")
        
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
            filtered_data = filtered_df.to_dict('records')
        else:
            filtered_data = data
        
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




if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
