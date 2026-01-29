"""
Authentication Service
Handles user authentication and authorization
"""
from typing import Optional, Dict, Any
from backend.utils.mongodb import get_users_collection
from bson import ObjectId
import bcrypt


class AuthService:
    """Authentication service"""
    
    @staticmethod
    def _hash_password(password: str) -> str:
        """
        Hash a password using bcrypt
        """
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    @staticmethod
    def _verify_password(password: str, hashed_password: str) -> bool:
        """
        Verify a password against a hashed password
        Supports both bcrypt hashed passwords and plain text (for backward compatibility)
        """
        # Check if password is already hashed (bcrypt hashes start with $2b$)
        if hashed_password.startswith('$2b$'):
            try:
                return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
            except Exception:
                return False
        else:
            # Backward compatibility: plain text password comparison
            # This allows existing users with plain text passwords to still login
            # New users will have hashed passwords
            return password == hashed_password
    
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
        
        stored_password = user.get("password")
        if not stored_password:
            return None
        
        # Verify password (supports both bcrypt and plain text for backward compatibility)
        if not AuthService._verify_password(password, stored_password):
            return None
        
        # If user has plain text password, upgrade it to hashed password
        if not stored_password.startswith('$2b$'):
            hashed_password = AuthService._hash_password(password)
            users_collection.update_one(
                {"_id": user["_id"]},
                {"$set": {"password": hashed_password}}
            )
        
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
        Passwords are automatically hashed using bcrypt
        """
        from datetime import datetime
        users_collection = get_users_collection()
        
        # Hash the password before storing
        hashed_password = AuthService._hash_password(password)
        
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
                        "password": hashed_password,
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
                "password": hashed_password,
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
