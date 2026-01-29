#!/usr/bin/env python3
"""
Create or update admin user in MongoDB
"""
import sys
import argparse
from backend.services.auth_service import AuthService


def main():
    parser = argparse.ArgumentParser(
        description="Create or update admin user",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m backend.scripts.create_admin
  python -m backend.scripts.create_admin --email admin@mydomain.com --password mypass123
  python -m backend.scripts.create_admin --email admin@mydomain.com --password mypass123 --name "Super Admin"
        """
    )
    
    parser.add_argument(
        "--email",
        default="admin@example.com",
        help="Admin email (default: admin@example.com)"
    )
    
    parser.add_argument(
        "--password",
        default="admin123",
        help="Admin password (default: admin123)"
    )
    
    parser.add_argument(
        "--name",
        default="Admin User",
        help="Admin name (default: Admin User)"
    )
    
    args = parser.parse_args()
    
    try:
        result = AuthService.create_admin_user(
            email=args.email,
            password=args.password,
            name=args.name
        )
        
        if result["success"]:
            action = result.get("action", "unknown")
            
            if action == "created":
                print("✅ Admin user created successfully!\n")
            elif action == "updated":
                print("✅ Admin user updated successfully!\n")
            else:
                print("ℹ️  Admin user exists with the same details (no update needed)\n")
            
            print("📋 Admin Details:")
            print(f"   - Email: {result['email']}")
            print(f"   - Password: {args.password}")
            print(f"   - Name: {result['name']}")
            print(f"   - Role: admin\n")
        else:
            print(f"❌ {result.get('message', 'Failed to create/update admin user')}")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
