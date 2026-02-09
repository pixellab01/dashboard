
import json
import sys
import urllib.request
import urllib.parse

BASE_URL = "http://localhost:8000"

def post_json(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode('utf-8'))

def get_session_id():
    return "session_e391d5350a0847d2a15f2034d301d6da"

def test_filters():
    session_id = get_session_id()
    print(f"Using Session ID: {session_id}")

    # 1. No Filter
    print("\n--- Testing No Filter ---")
    try:
        data_no_filter = post_json(
            f"{BASE_URL}/api/analytics/compute",
            {"sessionId": session_id, "filters": {}}
        )
    except Exception as e:
        print(f"Error fetching no-filter data: {e}")
        return

    states_nf = data_no_filter.get("top-10-states", [])
    couriers_nf = data_no_filter.get("top-10-couriers", [])
    print(f"Top State (No Filter): {states_nf[0]['_state'] if states_nf else 'None'} ({states_nf[0]['total_orders'] if states_nf else 0} orders)")
    print(f"Top Courier (No Filter): {couriers_nf[0]['_courier'] if couriers_nf else 'None'} ({couriers_nf[0]['total_orders'] if couriers_nf else 0} orders)")

    # 2. Filter by State (Pick the top state from no-filter)
    if states_nf:
        target_state = states_nf[0]['_state']
        print(f"\n--- Testing Filter: State = {target_state} ---")
        data_state_filter = post_json(
            f"{BASE_URL}/api/analytics/compute",
            {"sessionId": session_id, "filters": {"state": [target_state]}}
        )
        states_sf = data_state_filter.get("top-10-states", [])
        
        # Expectation: Only target_state should be in the list (or list length 1 if unique)
        print(f"States found: {[s['_state'] for s in states_sf]}")
        if len(states_sf) == 1 and states_sf[0]['_state'] == target_state:
            print("PASS: State filter correctly restricted Top 10 States table.")
        else:
            print("FAIL: State filter did not restrict table as expected.")

    # 3. Filter by Payment Method (e.g. COD - usually exists)
    print("\n--- Testing Filter: Payment Method = COD ---")
    data_pay_filter = post_json(
        f"{BASE_URL}/api/analytics/compute",
        {"sessionId": session_id, "filters": {"paymentMethod": ["COD"]}}
    )
    states_pf = data_pay_filter.get("top-10-states", [])
    
    # Expectation: Counts should be different (likely lower) than No Filter
    total_orders_nf = sum(s['total_orders'] for s in states_nf)
    total_orders_pf = sum(s['total_orders'] for s in states_pf)
    
    print(f"Total Orders (No Filter): {total_orders_nf}")
    print(f"Total Orders (COD Filter): {total_orders_pf}")
    
    if total_orders_pf < total_orders_nf:
        print("PASS: Payment filter affected the counts.")
    elif total_orders_pf == total_orders_nf:
        print("WARNING: Counts identical. Maybe all orders are COD or filter didn't work?")
        # Try PREPAID
        print("Trying PREPAID...")
        data_pay_filter = post_json(
            f"{BASE_URL}/api/analytics/compute",
            {"sessionId": session_id, "filters": {"paymentMethod": ["Prepaid"]}}
        )
        states_pf = data_pay_filter.get("top-10-states", [])
        total_orders_prepaid = sum(s['total_orders'] for s in states_pf)
        print(f"Total Orders (Prepaid Filter): {total_orders_prepaid}")
         
        if total_orders_prepaid < total_orders_nf:
             print("PASS: Prepaid filter affected the counts.")
        else:
             print("FAIL: Prepaid filter also had no effect?")

    else:
        print("FAIL: Filtered counts higher than total?")

if __name__ == "__main__":
    test_filters()
