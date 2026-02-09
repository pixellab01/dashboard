"""
Production-Ready Shipping Data Preprocessing
Optimized for pandas 2.x, speed, and schema safety
"""

from __future__ import annotations

import pandas as pd
import numpy as np
import re
from datetime import datetime
from typing import Dict


# ============================================================
# Utilities
# ============================================================

def normalize_keys(df: pd.DataFrame) -> pd.DataFrame:
    def to_snake(name: str) -> str:
        name = str(name).strip()
        name = re.sub(r"(?<!^)(?<!\s)(?=[A-Z])", "_", name)
        name = name.lower()
        name = re.sub(r"\s+", "_", name)
        name = re.sub(r"[^a-z0-9_]", "", name)
        return name

    df = df.copy()
    df.columns = [to_snake(c) for c in df.columns]
    return df


def safe_col(df: pd.DataFrame, col: str, default=np.nan) -> pd.Series:
    """Always return a Series, never None"""
    if col in df.columns:
        return df[col]
    return pd.Series(default, index=df.index)


# ============================================================
# Main Preprocessing
# ============================================================

def preprocess_shipping_data(df: pd.DataFrame) -> pd.DataFrame:
    start_ts = datetime.utcnow()
    df = df.copy()

    # --------------------------------------------------------
    # Normalize column names
    # --------------------------------------------------------
    df = normalize_keys(df)

    # --------------------------------------------------------
    # Standardize missing values
    # --------------------------------------------------------
    df.replace(
        to_replace=r"^\s*(none|n/a|na|null|)\s*$",
        value=np.nan,
        regex=True,
        inplace=True,
    )

    # --------------------------------------------------------
    # Date parsing
    # --------------------------------------------------------
    DATE_FIELDS: Dict[str, list[str]] = {
        "order_date": [
            "shiprocket__created__at",
            "channel__created__at",
            "order_date",
            "created_at",
        ],
        "pickup_date": [
            "order__picked__up__date",
            "pickup_date",
            "pickup_datetime",
        ],
        "ofd_date": [
            "first__out__for__delivery__date",
            "latest__o_f_d__date",
            "ofd_date",
        ],
        "delivery_date": [
            "order__delivered__date",
            "delivery_date",
            "delivered_date",
        ],
        "ndr_date": [
            "latest__n_d_r__date",
            "ndr_date",
        ],
        "rto_date": [
            "r_t_o__initiated__date",
            "rto_date",
        ],
    }

    parsed_dates: Dict[str, str] = {}

    for target, candidates in DATE_FIELDS.items():
        for col in candidates:
            if col in df.columns:
                parsed = pd.to_datetime(df[col], errors="coerce")
                if parsed.notna().any():
                    dt_col = f"{col}_dt"
                    df[dt_col] = parsed
                    df[target] = parsed.dt.strftime("%Y-%m-%d")
                    parsed_dates[target] = dt_col
                    break

    # --------------------------------------------------------
    # Numeric fields
    # --------------------------------------------------------
    NUMBER_FIELDS = {
        "order_value": ["order_total", "order_value", "amount", "gmv_amount"],
        "weight": ["weight_k_g", "weight"],
        "order_risk_score": ["order_risk", "address_score"],
    }

    for target, sources in NUMBER_FIELDS.items():
        for col in sources:
            if col in df.columns:
                series = (
                    df[col]
                    .astype(str)
                    .str.replace(r"[^0-9.-]", "", regex=True)
                    .replace("", np.nan)
                )
                series = pd.to_numeric(series, errors="coerce")
                if series.notna().any():
                    df[target] = series
                    break

    # --------------------------------------------------------
    # Boolean fields
    # --------------------------------------------------------
    BOOLEAN_FIELDS = ["ndr", "rto", "cancelled", "canceled", "is_verified"]

    for col in BOOLEAN_FIELDS:
        if col in df.columns:
            df[col] = (
                df[col]
                .astype(str)
                .str.lower()
                .isin(["true", "yes", "1", "y"])
            )

    # --------------------------------------------------------
    # Category / channel / identifiers
    # --------------------------------------------------------
    # --------------------------------------------------------
    # Category / channel / identifiers
    # --------------------------------------------------------
    
    # Robust Column Mapping Helper
    def resolve_mapped_col(df, target_name, candidates):
        """Find the first matching column from candidates in the dataframe that has data."""
        # Check all candidates (including target_name) for data
        all_candidates = []
        if target_name in df.columns:
            all_candidates.append(target_name)
        
        # Add other candidates if they exist
        for col in candidates:
            if col in df.columns and col != target_name:
                all_candidates.append(col)
        
        # First pass: Look for column with actual data (non-null)
        for col in all_candidates:
            if df[col].notna().any():
                return df[col]
        
        # Second pass: If no data found, return the first one that exists (to preserve structure)
        if all_candidates:
            return df[all_candidates[0]]
        
        # 3. Fallback: Check for partial match (e.g. "payment" in column name)
        # Only for specific targets where loose matching is safe
        if target_name == "payment_method":
             for col in df.columns:
                if "payment" in str(col).lower() and "method" in str(col).lower():
                    if df[col].notna().any():
                        return df[col]
                if "payment" in str(col).lower() and "type" in str(col).lower():
                    if df[col].notna().any():
                        return df[col]
                # Very loose fallback
                if "payment" in str(col).lower() and len(df.columns) < 50: # Safety check
                     if df[col].notna().any():
                        return df[col]

        return pd.Series(np.nan, index=df.index)

    # Define mappings (simplified from analytics.py to match normalized snake_case names)
    # Note: normalize_keys() has already run, so we expect snake_case inputs
    MAPPINGS = {
        "payment_method": ["payment__method", "payment_method", "payment_type", "payment_mode", "method_of_payment" , "Payment Method"],
        "product_name": ["product__name", "product_name", "item_name"],
        "channel": ["channel", "source", "platform"],
        "sku": ["channel__s_k_u", "master__s_k_u", "master_s_k_u", "channel_s_k_u", "sku", "item_sku", "variant_sku"]
    }

    df["category"] = (
        safe_col(df, "product_category")
        .combine_first(safe_col(df, "category"))
        .fillna("Uncategorized")
    )

    df["channel"] = resolve_mapped_col(df, "channel", MAPPINGS["channel"])
    df["sku"] = resolve_mapped_col(df, "sku", MAPPINGS["sku"])

    # Ensure product_name is found
    df["product_name"] = resolve_mapped_col(df, "product_name", MAPPINGS["product_name"])
    
    # Robust payment method resolution
    df["payment_method"] = resolve_mapped_col(df, "payment_method", MAPPINGS["payment_method"])

    # --------------------------------------------------------
    # Status normalization
    # --------------------------------------------------------
    status = safe_col(df, "status", "").astype(str).str.upper()
    df["original_status"] = status
    df["delivery_status"] = "PENDING"

    df.loc[status.str.contains("CANCEL", na=False), "delivery_status"] = "CANCELLED"
    df.loc[safe_col(df, "delivery_date").notna(), "delivery_status"] = "DELIVERED"
    df.loc[safe_col(df, "ndr_date").notna(), "delivery_status"] = "NDR"
    df.loc[safe_col(df, "rto_date").notna(), "delivery_status"] = "RTO INITIATED"
    df.loc[status.str.contains("OUT FOR DELIVERY", na=False), "delivery_status"] = "OFD"

    # --------------------------------------------------------
    # ✅ NDR / RTO FLAGS (CRITICAL FIX)
    # --------------------------------------------------------
    df["ndr_flag"] = (
        (df["delivery_status"] == "NDR") |
        safe_col(df, "ndr").fillna(False)
    )

    df["rto_flag"] = (
        (df["delivery_status"] == "RTO INITIATED") |
        safe_col(df, "rto").fillna(False)
    )

    # --------------------------------------------------------
    # Address quality
    # --------------------------------------------------------
    addr1 = safe_col(df, "address_line_1", "").fillna("")
    addr2 = safe_col(df, "address_line_2", "").fillna("")
    city  = safe_col(df, "city", "").fillna("")
    state = safe_col(df, "state", "").fillna("")
    pin   = safe_col(df, "pincode", "").fillna("")

    full_addr = addr1 + " " + addr2

    df["address_quality"] = np.select(
        [
            addr1.eq("") | full_addr.str.len().le(20),
            (full_addr.str.len().gt(20)) & (full_addr.str.len().le(40)),
        ],
        ["INVALID", "SHORT"],
        default="GOOD",
    )

    # --------------------------------------------------------
    # TAT calculations
    # --------------------------------------------------------
    def tat(start: str, end: str):
        if start in parsed_dates and end in parsed_dates:
            return (
                (df[parsed_dates[end]] - df[parsed_dates[start]])
                .dt.total_seconds()
                .div(3600)
            )
        return np.nan

    df["order_to_pickup_tat"] = tat("order_date", "pickup_date")
    df["pickup_to_ofd_tat"] = tat("pickup_date", "ofd_date")
    df["ofd_to_delivery_tat"] = tat("ofd_date", "delivery_date")
    df["total_tat"] = tat("order_date", "delivery_date")

    # --------------------------------------------------------
    # Order week (NumPy / pandas safe)
    # --------------------------------------------------------
    if "order_date" in parsed_dates:
        d = df[parsed_dates["order_date"]]
        day = d.dt.day

        week_start = pd.Series(
            np.select(
                [day <= 7, day <= 14, day <= 21, day <= 28],
                [1, 8, 15, 22],
                default=29,
            ),
            index=df.index,
        )

        week_end = pd.Series(
            np.select(
                [day <= 7, day <= 14, day <= 21, day <= 28],
                [7, 14, 21, 28],
                default=d.dt.days_in_month,
            ),
            index=df.index,
        )

        df["order_week"] = (
            d.dt.strftime("%Y-%m-")
            + week_start.astype(str).str.zfill(2)
            + "-"
            + week_end.astype(str).str.zfill(2)
        )
    else:
        df["order_week"] = np.nan

    # --------------------------------------------------------
    # Metadata & cleanup
    # --------------------------------------------------------
    df["processed_at"] = datetime.utcnow()
    df.drop(columns=[c for c in df.columns if c.endswith("_dt")], inplace=True)

    elapsed = (datetime.utcnow() - start_ts).total_seconds()
    print(f"✅ preprocess_shipping_data completed in {elapsed:.2f}s")

    return df
