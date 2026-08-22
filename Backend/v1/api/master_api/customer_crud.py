from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from utils.db_utils import SQLManager
from models.master_model import CustomerAddRequest, CustomerUpdateRequest, CustomerDeleteRequest
from middleware.auth_middleware import get_current_user
import logging

logger = logging.getLogger(__name__)
customer_router = APIRouter()


@customer_router.post("/add-customer")
def add_customer(
    request: CustomerAddRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a new customer (requires authentication)"""
    db = SQLManager()
    
    try:
        query = "EXEC SP_CUSTOMER_ADD ?, ?, ?, ?, ?, ?, ?, ?, ?, ?"
        
        params = (
            request.customer_code,
            request.customer_name,
            request.customer_type,
            request.gst_no,
            request.address,
            request.contact_person,
            request.contact_no,
            request.email_id,
            request.is_active,
            current_user["user_id"]  # Use authenticated user ID
        )
        
        response = db.execute_query(query, params, commit=True)
        
        if response.get("status") == "success" and response.get("data"):
            sp_result = response["data"][0] 
            
            if sp_result["Status"] == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=sp_result["Message"]
                )
            
            logger.info(f"Customer added by user {current_user['username']}")
            return {
                "status": "success", 
                "message": sp_result["Message"],
                "data": sp_result
            }
                
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add customer"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding customer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while adding customer"
        )
    finally:
        db.close_connection()


@customer_router.get("/get-customer")
def get_customer(
    customer_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get customer(s) (requires authentication)"""
    db = SQLManager()
    
    try:
        query = "EXEC SP_CUSTOMER_GET ?"
        params = (customer_id,)
        
        response = db.execute_query(query, params)
        
        if response.get("status") == "success" and response.get("data"):
            first_row = response["data"][0]
            
            if "Status" in first_row and first_row["Status"] == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=first_row["Message"]
                )
            
            return response
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve customer data"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving customer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving customer"
        )
    finally:
        db.close_connection()


@customer_router.post("/update-customer")
def update_customer(
    request: CustomerUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update customer (requires authentication)"""
    db = SQLManager()
    
    try:
        query = "EXEC SP_CUSTOMER_MODIFY ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?"
        
        params = (
            request.customer_id,
            request.customer_code,
            request.customer_name,
            request.customer_type,
            request.gst_no,
            request.address,
            request.contact_person,
            request.contact_no,
            request.email_id,
            request.is_active,
            current_user["user_id"]  # Use authenticated user ID
        )
        
        response = db.execute_query(query, params, commit=True)
        
        if response.get("status") == "success" and response.get("data"):
            sp_result = response["data"][0] 
            
            if sp_result["Status"] == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=sp_result["Message"]
                )
            
            logger.info(f"Customer {request.customer_id} updated by user {current_user['username']}")
            return {
                "status": "success", 
                "message": sp_result["Message"],
                "data": sp_result
            }
                
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update customer"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating customer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating customer"
        )
    finally:
        db.close_connection()


@customer_router.post("/delete-customer")
def delete_customer(
    request: CustomerDeleteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Delete customer (requires authentication)"""
    db = SQLManager()
    
    try:
        query = "EXEC SP_CUSTOMER_DELETE ?, ?"
        
        params = (
            request.customer_id,
            current_user["user_id"]  # Use authenticated user ID
        )
        
        response = db.execute_query(query, params, commit=True)
        
        if response.get("status") == "success" and response.get("data"):
            sp_result = response["data"][0] 
            
            if sp_result["Status"] == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=sp_result["Message"]
                )
            
            logger.info(f"Customer {request.customer_id} deleted by user {current_user['username']}")
            return {
                "status": "success", 
                "message": sp_result["Message"],
                "data": sp_result
            }
                
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete customer"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting customer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting customer"
        )
    finally:
        db.close_connection()