"""
FastAPI Application for Analytics Dashboard (Optimized)
"""
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import logging
import time
import uvicorn
import pandas as pd
import polars as pl
import uuid

from backend.data_store import get_dataframe
from backend.analytics import compute_all_analytics, filter_shipping_data_pl, COLUMN_MAP # Using Polars filter and shared column map
from backend.api import auth, google_drive, admin, stats

app = FastAPI(title="Analytics Dashboard API", version="1.0.0")

# Simple request timing to identify slow endpoints quickly
@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - t0) * 1000
    logging.info("%s %s -> %d (%.1fms)", request.method, request.url.path, response.status_code, ms)
    response.headers["X-Process-Time-ms"] = f"{ms:.1f}"
    return response

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Analytics Dashboard API"}

@app.post("/api/analytics/compute")
async def compute_analytics(request: ComputeAnalyticsRequest):
    """
    POST /api/analytics/compute
    This is the primary endpoint for all analytics.
    It loads the pre-processed data, applies filters, and computes all analytics in one go.
    """
    try:
        if not request.sessionId:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        df = get_dataframe(request.sessionId)
        if df is None:
            # Info level as this is expected during initial polling
            logging.info(f"No Parquet file found for session {request.sessionId}")
            raise HTTPException(
                status_code=404,
                detail=f"No data found for session {request.sessionId}. Please process a file first."
            )
        
        # Convert to Polars
        pl_df = pl.from_pandas(df)
        
        # Normalize FIRST so that filter columns (like _status, _payment) exist
        from backend.analytics import normalize_dataframe_pl
        pl_df_normalized = normalize_dataframe_pl(pl_df)
        
        # Apply filters on the normalized Polars DataFrame
        filtered_df = filter_shipping_data_pl(pl_df_normalized, request.filters)

        # Compute analytics using the filtered, normalized data
        result = compute_all_analytics(filtered_df, request.sessionId)
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=f"Failed to compute analytics: {result.get('errors')}")
        
        return result

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/filter-options")
async def get_filter_options(
    sessionId: str, 
    channel: List[str] = Query(None),
    sku: List[str] = Query(None)
):
    """Get unique filter options (channels, SKUs, product names, statuses)
    
    When a channel is specified, SKUs and product names are filtered to that channel only.
    When a SKU is specified, product names are filtered to that SKU only.
    """
    try:
        if not sessionId:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        df = get_dataframe(sessionId)
        if df is None:
            raise HTTPException(status_code=404, detail="No data found for session.")

        # Use the centralized COLUMN_MAP from analytics.py
        # This ensures consistent column resolution across the application
        
        # Helper to find column from mapped keys
        def resolve_col(keys):
            for k in keys:
                if k in df.columns:
                    return k
            return None

        # Resolve columns
        channel_col = resolve_col(COLUMN_MAP.get('channel', ['channel', 'Channel', 'channel__']))
        sku_col = resolve_col(COLUMN_MAP.get('sku', ['master__s_k_u', 'sku']))
        product_col = resolve_col(COLUMN_MAP.get('product', ['product_name', 'product__name']))
        status_col = resolve_col(COLUMN_MAP.get('status', ['status', 'original_status']))
        payment_col = resolve_col(COLUMN_MAP.get('payment', ['payment_method', 'payment__method']))
        state_col = resolve_col(COLUMN_MAP.get('state', ['state', 'address__state']))
        courier_col = resolve_col(COLUMN_MAP.get('courier', ['courier_company', 'courier__company', 'master_courier', 'courier_name']))
        ndr_desc_col = resolve_col(COLUMN_MAP.get('ndr_description', ['latest__n_d_r__reason', 'latest_ndr_reason', 'ndr_reason', 'ndr_description']))
        ndr_count_col = resolve_col(COLUMN_MAP.get('ndr_count', ['ndr_attempt', 'ndr_count', 'attempt_count', 'number_of_attempts']))
        
        # Fallback: Search for any column containing "ndr" and "reason" case-insensitively if not found
        if not ndr_desc_col:
            for col in df.columns:
                lower_col = str(col).lower()
                if "ndr" in lower_col and "reason" in lower_col:
                    ndr_desc_col = col
                    print(f"DEBUG: Found fallback NDR column: {col}")
                    break
        
        print(f"DEBUG: Selected NDR Column: {ndr_desc_col}")
        
        # Fallback: Search for any column containing "payment" case-insensitively if not found
        if not payment_col:
            for col in df.columns:
                if "payment" in str(col).lower():
                    payment_col = col
                    break
        
        # --- DEBUG LOGGING START ---
        print(f"DEBUG: Session {sessionId}")
        print(f"DEBUG: DataFrame Columns: {list(df.columns)}")
        print(f"DEBUG: COLUMN_MAP['ndr_description'] = {COLUMN_MAP.get('ndr_description')}")
        print(f"DEBUG: Resolved ndr_desc_col: {ndr_desc_col}")
        # --- DEBUG LOGGING END ---
        

        def get_unique_values(df, col_name):
            """Get unique values from a specific column."""
            if not col_name or col_name not in df.columns:
                return []
            
            # Helper to check validity
            def is_valid(v):
                if v is None: return False
                s = str(v).strip()
                return s and s.lower() not in ['', 'none', 'n/a', 'na', 'null', 'undefined', 'nan']

            values = df[col_name].dropna().unique().tolist()
            return [v for v in values if is_valid(v)]

        # Always get all channels and statuses (not filtered)
        channels = get_unique_values(df, channel_col)
        statuses = get_unique_values(df, status_col)
        payment_methods = get_unique_values(df, payment_col)
        states = get_unique_values(df, state_col)
        couriers = get_unique_values(df, courier_col)
        ndr_descriptions = get_unique_values(df, ndr_desc_col)
        ndr_counts = get_unique_values(df, ndr_count_col)
        
        # If we have internal normalized columns, we can also check them if primary check fails,
        # but COLUMN_MAP is usually robust enough. 
        # For payment, let's also try '_payment' if available from a previous normalization step (unlikely here as we load raw parquet, but safe to check)
        if not payment_methods and '_payment' in df.columns:
             payment_methods = get_unique_values(df, '_payment')
        
        if not states and '_state' in df.columns:
             states = get_unique_values(df, '_state')
        
        if not couriers and '_courier' in df.columns:
             couriers = get_unique_values(df, '_courier')

        if not ndr_descriptions and '_ndr_description' in df.columns:
             ndr_descriptions = get_unique_values(df, '_ndr_description')

        if not ndr_counts and '_ndr_count' in df.columns:
             ndr_counts = get_unique_values(df, '_ndr_count')

        
        # Apply filters to the DataFrame for cascading options
        filtered_df = df
        
        # Filter by Channel
        if channel:
            valid_channels = [c for c in channel if c and c != 'All']
            if valid_channels:
                if channel_col:
                    filtered_df = filtered_df[filtered_df[channel_col].isin(valid_channels)]
        
        # Filter by SKU (New logic)
        if sku:
            valid_skus = [s for s in sku if s and s != 'All']
            if valid_skus:
                if sku_col:
                    filtered_df = filtered_df[filtered_df[sku_col].isin(valid_skus)]
        
        # Get SKUs and product names from the filtered DataFrame
        # SKUs should be filtered by Channel, but usually not by themselves (unless we want to show only selected SKUs?)
        # Typically "available" SKUs should be constrained by Channel.
        # "available" Products should be constrained by Channel AND selected SKU.
        
        # IMPORTANT: To allow changing SKU selection, we should calculate available SKUs based on Channel ONLY,
        # otherwise selecting 1 SKU would hide all others.
        
        # 1. Calc SKUs based on Channel Only
        df_for_skus = df
        if channel:
            valid_channels = [c for c in channel if c and c != 'All']
            if valid_channels and channel_col:
                df_for_skus = df[df[channel_col].isin(valid_channels)]
        
        skus = get_unique_values(df_for_skus, sku_col)
        
        # 2. Calc Products based on Channel AND SKU
        # filtered_df already has both applied
        product_names = get_unique_values(filtered_df, product_col)
        
        # Get top 10 by frequency for SKUs and product names (for quick filter options)
        def get_top_10(df, col_name):
            """Get top 10 most frequent values."""
            if not col_name or col_name not in df.columns:
                return []
            value_counts = df[col_name].value_counts().head(10)
            return value_counts.index.tolist()
        
        skus_top_10 = get_top_10(df_for_skus, sku_col)
        product_names_top_10 = get_top_10(filtered_df, product_col)

        return {
            "success": True,
            "channels": sorted([str(c) for c in channels]),
            "skus": sorted([str(s) for s in skus]),
            "skusTop10": [str(s) for s in skus_top_10],
            "productNames": sorted([str(p) for p in product_names]),
            "productNamesTop10": [str(p) for p in product_names_top_10],
            "statuses": sorted([str(s) for s in statuses]),
            "paymentMethods": sorted([str(p) for p in payment_methods]),
            "states": sorted([str(s) for s in states]),
            "couriers": sorted([str(c) for c in couriers]),
            "ndrDescriptions": sorted([str(d) for d in ndr_descriptions]),
            "ndrCounts": sorted([str(c) for c in ndr_counts]),
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
