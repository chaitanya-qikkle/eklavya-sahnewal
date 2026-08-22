"""
Auth repository — all database calls for authentication and user management.
No business logic here; only SQL/SP execution and raw result return.
"""
from typing import Optional

from app.repositories.base import BaseRepository


class AuthRepository(BaseRepository):

    # ── Login ─────────────────────────────────────────────────────────────────

    def login(self, username: str, password: str) -> dict:
        return self._exec("EXEC SP_USER_LOGIN ?, ?", (username, password), commit=True)

    # ── Users ─────────────────────────────────────────────────────────────────

    def get_users(self) -> dict:
        return self._exec("EXEC dbo.SP_AUTH_USER_LIST")

    def create_user(
        self,
        role_id: int,
        first_name: str,
        last_name: str,
        username: str,
        password: str,
        email_id: str,
        created_by: int,
    ) -> dict:
        return self._exec(
            "EXEC SP_USER_CREATE ?, ?, ?, ?, ?, ?, ?",
            (role_id, first_name, last_name, username, password, email_id, created_by),
            commit=True,
        )

    def update_user(
        self,
        user_id: int,
        role_id: int,
        first_name: str,
        last_name: str,
        username: str,
        password: Optional[str],
        email_id: str,
        is_active: bool,
        modified_by: int,
    ) -> dict:
        return self._exec(
            "EXEC SP_USER_MODIFY ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (user_id, role_id, first_name, last_name, username, password,
             email_id, 1 if is_active else 0, modified_by),
            commit=True,
        )

    def delete_user(self, user_id: int, deleted_by: int) -> dict:
        return self._exec("EXEC SP_USER_DELETE ?, ?", (user_id, deleted_by), commit=True)

    # ── Roles ─────────────────────────────────────────────────────────────────

    def get_roles(self) -> dict:
        return self._exec("EXEC dbo.SP_AUTH_ROLE_LIST")

    def create_role(self, role: str, plant_id: Optional[int], created_by: int) -> dict:
        return self._exec(
            "EXEC dbo.SP_AUTH_ROLE_UPSERT ?, ?, ?",
            (role, plant_id, created_by),
            commit=True,
        )

    def update_role(self, role_id: int, role: str, plant_id: Optional[int], modified_by: int) -> dict:
        return self._exec(
            "EXEC dbo.SP_AUTH_ROLE_UPDATE ?, ?, ?, ?",
            (role_id, role, plant_id, modified_by),
            commit=True,
        )

    def delete_role(self, role_id: int, deleted_by: int) -> dict:
        return self._exec("EXEC SP_ROLE_DELETE ?, ?", (role_id, deleted_by), commit=True)

    # ── Menus ─────────────────────────────────────────────────────────────────

    def get_menus(self) -> dict:
        return self._exec("EXEC dbo.SP_MENU_GET_ALL")

    def create_menu(
        self,
        menu_name: str,
        parent_menu_id: Optional[int],
        menu_url: Optional[str],
        menu_icon: Optional[str],
        area: Optional[str],
        controller: Optional[str],
        action_result: Optional[str],
        plant_name: Optional[str],
        sort_order: int,
        created_by: Optional[int],
    ) -> dict:
        return self._exec(
            "EXEC dbo.SP_MENU_ADD ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (menu_name, parent_menu_id, menu_url, menu_icon, area,
             controller, action_result, plant_name, sort_order, created_by),
            commit=True,
        )

    def update_menu(
        self,
        menu_id: int,
        menu_name: str,
        parent_menu_id: Optional[int],
        menu_url: Optional[str],
        menu_icon: Optional[str],
        area: Optional[str],
        controller: Optional[str],
        action_result: Optional[str],
        plant_name: Optional[str],
        sort_order: int,
        is_active: bool,
        modified_by: Optional[int],
    ) -> dict:
        return self._exec(
            "EXEC dbo.SP_MENU_MODIFY ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (menu_id, menu_name, parent_menu_id, menu_url, menu_icon, area,
             controller, action_result, plant_name, sort_order, is_active, modified_by),
            commit=True,
        )

    def delete_menu(self, menu_id: int, deleted_by: Optional[int]) -> dict:
        return self._exec("EXEC dbo.SP_MENU_DELETE ?, ?", (menu_id, deleted_by), commit=True)

    def set_role_menus(self, role_id: int, menu_ids_csv: str, created_by: Optional[int]) -> dict:
        return self._exec(
            "EXEC dbo.SP_ROLE_MENU_SET ?, ?, ?",
            (role_id, menu_ids_csv, created_by),
            commit=True,
        )

    def get_role_menus(self, role_id: int) -> dict:
        return self._exec("EXEC dbo.SP_ROLE_MENU_GET_BY_ROLE ?", (role_id,))
