#!/usr/bin/env python3
"""
Example usage of the Python Analytics Backend
"""
import requests
import json
from backend.data_loader import load_data_from_json, generate_session_id
from backend.redis_client import save_shipping_data_to_redis


def example_compute_analytics():
    """Example: Compute analytics for sample data"""
    
    # Sample shipping data
    sample_data = [
        {
            "Order Date": "2025-01-15",
            "Status": "DELIVERED",
            "Order Total": 1500.00,
            "Channel": "Shopify",
            "Payment Method": "COD",
            "Product Name": "Product A",
            "Master SKU": "SKU-001",
            "Address State": "Maharashtra",
        },
        {
            "Order Date": "2025-01-16",
            "Status": "NDR",
            "Order Total": 2000.00,
            "Channel": "Amazon",
            "Payment Method": "Online",
            "Product Name": "Product B",
            "Master SKU": "SKU-002",
            "Address State": "Karnataka",
        },
    ]
    
    # Load data to Redis
    print("Loading data to Redis...")
    session_id = load_data_from_json(sample_data)
    print(f"Session ID: {session_id}")
    
    # Compute analytics
    print("\nComputing analytics...")
    response = requests.post(
        "http://localhost:8000/api/analytics/compute",
        json={
            "sessionId": session_id,
            "filters": None
        }
    )
    
    if response.status_code == 200:
        print("✅ Analytics computed successfully!")
        result = response.json()
        print(json.dumps(result, indent=2))
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
    
    # Get analytics
    print("\nFetching weekly summary...")
    response = requests.get(
        f"http://localhost:8000/api/analytics/weekly-summary",
        params={"sessionId": session_id}
    )
    
    if response.status_code == 200:
        analytics = response.json()
        print(json.dumps(analytics, indent=2))
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)


def example_with_filters():
    """Example: Compute analytics with filters"""
    
    # Load your data first
    session_id = generate_session_id()
    
    # ... load your data here ...
    
    # Compute with filters
    response = requests.post(
        "http://localhost:8000/api/analytics/compute",
        json={
            "sessionId": session_id,
            "filters": {
                "startDate": "2025-01-01",
                "endDate": "2025-01-31",
                "orderStatus": "DELIVERED",
                "channel": "Shopify",
            }
        }
    )
    
    print(response.json())


if __name__ == "__main__":
    print("=" * 60)
    print("Python Analytics Backend - Example Usage")
    print("=" * 60)
    print("\nMake sure the backend server is running:")
    print("  python run_backend.py")
    print("\nThen run this example:")
    print("  python example_usage.py")
    print("\n" + "=" * 60 + "\n")
    
    # Uncomment to run examples:
    # example_compute_analytics()
    # example_with_filters()
