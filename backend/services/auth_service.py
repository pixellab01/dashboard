"""
Authentication Service
Handles user authentication and authorization
"""
from typing import Optional, Dict, Any
from backend.utils.mongodb import get_users_collection
from bson import ObjectId


class AuthService:
    """Authentication service"""
    
    @staticmethod
    def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Authenticate user by email and password
        Returns user data without password if successful, None otherwise
        """
        users_collection = get_users_collection()
        
        # Find user
        user = users_collection.find_one({"email": email})
        
        if not user:
            return None
        
        # Simple password comparison (in production, use bcrypt or similar)
        if user.get("password") != password:
            return None
        
        # Return user data without password
        user_dict = dict(user)
        user_dict.pop("password", None)
        user_dict["id"] = str(user_dict["_id"])
        user_dict.pop("_id", None)
        
        return user_dict
    
    @staticmethod
    def create_admin_user(email: str, password: str, name: str = "Admin User") -> Dict[str, Any]:
        """
        Create or update admin user
        Ensures only one admin user exists
        """
        from datetime import datetime
        users_collection = get_users_collection()
        
        # Find existing admin users
        existing_admins = list(users_collection.find({"role": "admin"}))
        
        if existing_admins:
            # If multiple admins, remove extras and keep only one
            if len(existing_admins) > 1:
                admin_to_keep = existing_admins[0]["_id"]
                result = users_collection.delete_many({
                    "role": "admin",
                    "_id": {"$ne": admin_to_keep}
                })
                print(f"⚠️  Removed {result.deleted_count} extra admin user(s)")
            
            # Update the existing admin user
            admin_id = existing_admins[0]["_id"]
            update_result = users_collection.update_one(
                {"_id": admin_id},
                {
                    "$set": {
                        "email": email,
                        "password": password,
                        "name": name,
                        "role": "admin",
                        "updatedAt": datetime.now().isoformat()
                    }
                }
            )
            
            if update_result.modified_count > 0:
                return {
                    "success": True,
                    "action": "updated",
                    "message": "Admin user updated successfully",
                    "email": email,
                    "name": name
                }
            else:
                return {
                    "success": True,
                    "action": "no_change",
                    "message": "Admin user exists with the same details",
                    "email": email,
                    "name": name
                }
        else:
            # Create new admin user
            new_admin = {
                "email": email,
                "password": password,
                "name": name,
                "role": "admin",
                "createdAt": datetime.now().isoformat(),
                "updatedAt": datetime.now().isoformat()
            }
            
            result = users_collection.insert_one(new_admin)
            
            if result.inserted_id:
                return {
                    "success": True,
                    "action": "created",
                    "message": "Admin user created successfully",
                    "email": email,
                    "name": name
                }
        
        return {
            "success": False,
            "message": "Failed to create/update admin user"
        }
    
    @staticmethod
    def get_admin_credentials() -> Optional[Dict[str, Any]]:
        """
        Get admin user credentials
        """
        users_collection = get_users_collection()
        admin = users_collection.find_one({"role": "admin"})
        
        if not admin:
            return None
        
        return {
            "email": admin.get("email"),
            "name": admin.get("name"),
            "role": admin.get("role")
        }
