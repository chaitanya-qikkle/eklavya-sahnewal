"""
Auth repository — all database calls for authentication and user management.
No business logic here; only SQL/SP execution and raw result return.

Every call targets a real stored procedure in YMS_EKLAVYA (the
GET_IND_MST_*/INS_IND_MST_*/UPD_IND_MST_*/DEL_IND_MST_* family). User, role,
and menu identifiers created-by/modified-by/deleted-by are all GUID strings
(uniqueidentifier columns) — not ints.
"""
from typing import Optional

from app.repositories.base import BaseRepository


class AuthRepository(BaseRepository):

    # ── Login ─────────────────────────────────────────────────────────────────

    def login(self, username: str, password: str) -> dict:
        return self._exec("EXEC dbo.GET_USER_CREDENTIALS ?, ?", (username, password))

    def record_login_history(self, plant_id: Optional[int], user_id: str, event_type: str) -> dict:
        return self._exec(
            "EXEC dbo.INS_IND_MST_LOGIN_HISTORY ?, ?, ?",
            (plant_id, user_id, event_type),
            commit=True,
        )

    # ── Users ─────────────────────────────────────────────────────────────────

    def get_users(self) -> dict:
        return self._exec("EXEC dbo.GET_IND_MST_USER_LIST")

    def get_user_by_id(self, user_id: str) -> dict:
        return self._exec("EXEC dbo.GET_IND_MST_USER_BYID ?", (user_id,))

    def create_user(
        self,
        role_id: int,
        plant_id: int,
        client_id: int,
        first_name: str,
        last_name: str,
        username: str,
        password: str,
        email_id: str,
        created_by: str,
    ) -> dict:
        return self._exec(
            "EXEC dbo.INS_IND_MST_USER ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            ("00000000-0000-0000-0000-000000000000", role_id, plant_id, client_id,
             first_name, last_name, username, password, email_id, created_by, 0),
            commit=True,
        )

    def update_user(
        self,
        user_id: str,
        role_id: int,
        plant_id: int,
        client_id: int,
        first_name: str,
        last_name: str,
        username: str,
        password: str,
        email_id: str,
        modified_by: str,
    ) -> dict:
        return self._exec(
            "EXEC dbo.UPD_IND_MST_USER ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (user_id, role_id, plant_id, client_id, first_name, last_name,
             username, password, email_id, modified_by, 0),
            commit=True,
        )

    def update_user_password(self, user_id: str, password: str) -> dict:
        return self._exec(
            "EXEC dbo.UPD_IND_MST_USER_PASSWORD ?, ?, ?",
            (user_id, password, 0),
            commit=True,
        )

    def delete_user(self, user_id: str, deleted_by: str) -> dict:
        return self._exec(
            "EXEC dbo.DEL_IND_MST_USER ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (user_id, 0, 0, 0, "", "", "", "", "", deleted_by, 0),
            commit=True,
        )

    # ── Roles ─────────────────────────────────────────────────────────────────

    def get_roles(self) -> dict:
        return self._exec("EXEC dbo.GET_IND_MST_ROLE_LIST")

    def get_role_by_id(self, role_id: int) -> dict:
        return self._exec("EXEC dbo.GET_IND_MST_ROLE_BYID ?", (role_id,))

    def create_role(self, role_name: str, plant_id: Optional[int], created_by: str) -> dict:
        return self._exec(
            "EXEC dbo.INS_IND_MST_ROLE ?, ?, ?, ?, ?",
            (0, role_name, plant_id, created_by, 0),
            commit=True,
        )

    def update_role(self, role_id: int, role_name: str, plant_id: Optional[int], modified_by: str) -> dict:
        return self._exec(
            "EXEC dbo.UPD_IND_MST_ROLE ?, ?, ?, ?, ?",
            (role_id, role_name, plant_id, modified_by, 0),
            commit=True,
        )

    def delete_role(self, role_id: int, deleted_by: str) -> dict:
        return self._exec(
            "EXEC dbo.DEL_IND_MST_ROLE ?, ?, ?, ?, ?",
            (role_id, "", None, deleted_by, 0),
            commit=True,
        )

    # ── Menus ─────────────────────────────────────────────────────────────────

    def get_menus(self, plant_id: Optional[int]) -> dict:
        return self._exec("EXEC dbo.GET_IND_MST_MENU_LIST ?", (plant_id,))

    def get_menu_by_id(self, menu_id: int) -> dict:
        return self._exec("EXEC dbo.GET_IND_MST_MENU_BYID ?", (menu_id,))

    def create_menu(
        self,
        menu_name: str,
        parent_menu_id: Optional[int],
        menu_url: Optional[str],
        menu_icon: Optional[str],
        area: Optional[str],
        controller: Optional[str],
        action_result: Optional[str],
        plant_id: Optional[int],
        created_by: str,
    ) -> dict:
        return self._exec(
            "EXEC dbo.INS_IND_MST_MENU ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (0, menu_name, parent_menu_id or 0, plant_id, menu_url, menu_icon,
             area, controller, action_result, created_by, 0),
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
        plant_id: Optional[int],
        modified_by: str,
    ) -> dict:
        return self._exec(
            "EXEC dbo.UPD_IND_MST_MENU ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (menu_id, menu_name, parent_menu_id or 0, plant_id, menu_url, menu_icon,
             area, controller, action_result, modified_by, 0),
            commit=True,
        )

    def delete_menu(self, menu_id: int, deleted_by: str) -> dict:
        # DEL_IND_MST_MENU declares its params in a different order than INS/UPD
        # (MenuIcon comes after ActionResult, not before Area).
        return self._exec(
            "EXEC dbo.DEL_IND_MST_MENU ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (menu_id, "", 0, None, "", "", "", "", "", deleted_by, 0),
            commit=True,
        )

    # ── Role ↔ Menu ───────────────────────────────────────────────────────────

    def get_role_parent_menus(self, role_id: int) -> dict:
        """Top-level menus with an IsChecked flag. Note: the underlying SP hard-codes
        RoleID = 1 for the checked-state lookup regardless of @RoleId — a bug in the
        stored procedure itself, not something fixable from the app layer."""
        return self._exec("EXEC dbo.GET_IND_MST_ROLE_MENU_LIST ?", (role_id,))

    def get_role_sub_menus(self, role_id: int) -> dict:
        return self._exec("EXEC dbo.GET_IND_MST_ROLE_SUBMENU_LIST ?", (role_id,))

    def set_role_menus(self, role_id: int, menu_rows: list) -> dict:
        """menu_rows: list of (RoleID, MenuID, CreatedBy, CreatedDate) tuples — a
        table-valued parameter, so this goes through {CALL ...} syntax directly
        (plain "EXEC sp ?, ?" placeholders don't support TVPs)."""
        from app.core.database import get_connection

        conn = self.db.conn or get_connection()
        if not conn:
            return {"status": "error", "message": "Database connection unavailable"}
        try:
            cur = conn.cursor()
            cur.execute("{CALL sp_BulkInsertRoleMenu (?, ?)}", (role_id, menu_rows))
            rows = []
            if cur.description:
                cols = [c[0] for c in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            conn.commit()
            cur.close()
            return {"status": "success", "message": "Role menus updated", "data": rows}
        except Exception as exc:
            conn.rollback()
            return {"status": "error", "message": f"Database operation failed: {exc}"}
