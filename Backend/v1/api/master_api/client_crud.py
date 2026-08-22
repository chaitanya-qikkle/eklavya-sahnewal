from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from typing import Optional
from pathlib import Path
from uuid import uuid4
import logging
import shutil

from utils.db_utils import SQLManager
from models.master_model import ClientDeleteRequest
from middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
client_router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[3]
UPLOAD_DIR = BASE_DIR / "uploads" / "clients"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _save_logo_file(logo: UploadFile | None) -> str | None:
    if not logo or not logo.filename:
        return None

    if logo.content_type and not logo.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo must be an image file",
        )

    ext = Path(logo.filename).suffix
    filename = f"client_{uuid4().hex}{ext}"
    destination = UPLOAD_DIR / filename

    with destination.open("wb") as buffer:
        shutil.copyfileobj(logo.file, buffer)

    return f"/uploads/clients/{filename}"


def _delete_logo_file(logo_path: str | None) -> None:
    if not logo_path:
        return

    relative_path = logo_path.lstrip("/")
    file_path = BASE_DIR / relative_path
    if file_path.exists() and file_path.is_file():
        file_path.unlink()


def _get_existing_logo(db: SQLManager, client_id: int) -> str | None:
    response = db.execute_query("EXEC SP_CLIENT_GET ?", (client_id,))
    if response.get("status") != "success" or not response.get("data"):
        return None

    row = response["data"][0]
    if row.get("Status") == 0 or row.get("STATUS") == 0:
        return None

    return row.get("LOGO_PATH") or row.get("logo_path")


@client_router.post("/add-client")
def add_client(
    client_name: str = Form(...),
    logo: UploadFile | None = File(None),
    current_user: dict = Depends(get_current_user),
):
    """Add a new client (requires authentication)"""
    db = SQLManager()

    try:
        clean_name = client_name.strip()
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Client name is required",
            )

        logo_path = _save_logo_file(logo)

        query = "EXEC SP_CLIENT_ADD ?, ?, ?, ?"
        params = (
            clean_name,
            logo_path,
            1,
            current_user["user_id"],
        )

        logger.info("Adding client: name=%s", clean_name)
        response = db.execute_query(query, params, commit=True)
        logger.info("DB response: %s", response)
        
        if response.get("status") == "error":
            if logo_path:
                _delete_logo_file(logo_path)
            logger.error(f"DB error adding client: {response.get('message')}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=response.get("message", "Database operation failed")
            )
        
        if response.get("status") == "success" and response.get("data"):
            sp_result = response["data"][0]

            if sp_result.get("Status") == 0:
                if logo_path:
                    _delete_logo_file(logo_path)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=sp_result.get("Message", "Operation failed")
                )
            
            logger.info("Client added by user %s", current_user["username"])
            return {
                "status": "success", 
                "message": sp_result.get("Message", "Client added successfully"),
                "data": sp_result
            }
                
        if logo_path:
            _delete_logo_file(logo_path)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add client - no data returned"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding client: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while adding client: {str(e)}"
        )
    finally:
        db.close_connection()


@client_router.get("/get-client")
def get_client(
    client_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get client(s) (requires authentication)"""
    db = SQLManager()
    
    try:
        # SP_CLIENT_GET: @CLIENT_ID
        query = "EXEC SP_CLIENT_GET ?"
        params = (client_id,)
        
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
            detail="Failed to retrieve client data"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving client: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving client"
        )
    finally:
        db.close_connection()


@client_router.get("/get-client-all")
def get_client_all(current_user: dict = Depends(get_current_user)):
    """Get all clients without plant filtering (for dropdowns)"""
    db = SQLManager()

    try:
        # SP_CLIENT_GET: @CLIENT_ID (NULL = get all)
        query = "EXEC SP_CLIENT_GET NULL"
        response = db.execute_query(query)

        if response.get("status") == "success" and response.get("data"):
            first_row = response["data"][0]

            if "Status" in first_row and first_row["Status"] == 0:
                return {"status": "success", "data": []}

            return response

        return {"status": "success", "data": []}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving all clients: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving clients"
        )
    finally:
        db.close_connection()


@client_router.post("/update-client")
def update_client(
    client_id: int = Form(...),
    client_name: str = Form(...),
    logo: UploadFile | None = File(None),
    current_user: dict = Depends(get_current_user),
):
    """Update client (requires authentication)"""
    db = SQLManager()

    try:
        clean_name = client_name.strip()
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Client name is required",
            )

        existing_logo = _get_existing_logo(db, client_id) if logo else None
        logo_path = _save_logo_file(logo) if logo else None

        query = "EXEC SP_CLIENT_MODIFY ?, ?, ?, ?"
        params = (
            client_id,
            clean_name,
            logo_path,
            current_user["user_id"],
        )

        response = db.execute_query(query, params, commit=True)
        
        if response.get("status") == "error":
            if logo_path:
                _delete_logo_file(logo_path)
            logger.error(f"DB error updating client: {response.get('message')}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=response.get("message", "Database operation failed")
            )
        
        if response.get("status") == "success" and response.get("data"):
            sp_result = response["data"][0]

            if sp_result.get("Status") == 0:
                if logo_path:
                    _delete_logo_file(logo_path)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=sp_result.get("Message", "Update failed")
                )

            if logo_path and existing_logo and existing_logo != logo_path:
                _delete_logo_file(existing_logo)

            logger.info("Client %s updated by user %s", client_id, current_user["username"])
            return {
                "status": "success", 
                "message": sp_result.get("Message", "Client updated successfully"),
                "data": sp_result
            }

        if logo_path:
            _delete_logo_file(logo_path)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update client"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating client: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while updating client: {str(e)}"
        )
    finally:
        db.close_connection()


@client_router.post("/delete-client")
def delete_client(
    request: ClientDeleteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Delete client (requires authentication)"""
    db = SQLManager()
    
    try:
        # SP_CLIENT_DELETE: @CLIENT_ID, @MODIFIED_BY
        query = "EXEC SP_CLIENT_DELETE ?, ?"
        
        params = (
            request.client_id,
            current_user["user_id"]
        )
        
        existing_logo = _get_existing_logo(db, request.client_id)
        response = db.execute_query(query, params, commit=True)
        
        if response.get("status") == "error":
            logger.error(f"DB error deleting client: {response.get('message')}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=response.get("message", "Database operation failed")
            )
        
        if response.get("status") == "success" and response.get("data"):
            sp_result = response["data"][0] 
            
            if sp_result.get("Status") == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=sp_result.get("Message", "Delete failed")
                )
            
            if existing_logo:
                _delete_logo_file(existing_logo)
            logger.info("Client %s deleted by user %s", request.client_id, current_user["username"])
            return {
                "status": "success", 
                "message": sp_result.get("Message", "Client deleted successfully"),
                "data": sp_result
            }
                
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete client"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting client: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while deleting client: {str(e)}"
        )
    finally:
        db.close_connection()