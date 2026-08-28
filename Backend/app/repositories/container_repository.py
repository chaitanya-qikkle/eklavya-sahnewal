"""
Container repository — DB calls for container inventory, live status, and e-survey.
Every query goes through a stored procedure — no inline SQL.
"""
from typing import Optional

from app.repositories.base import BaseRepository


class ContainerRepository(BaseRepository):

    def get_container_inventory(
        self,
        page_index: int,
        page_size: int,
        search_for: Optional[str],
    ) -> dict:
        return self._exec_all(
            "EXEC dbo.SP_GetContainerInventory @PageIndex = ?, @SearchFor = ?, @PageSize = ?",
            (page_index, search_for, page_size),
        )

    def get_container_live_status(self, search_for: Optional[str] = None) -> dict:
        # SP handles both NULL (all containers) and CSV search string
        return self._exec(
            "EXEC dbo.SP_CONTAINER_LIVE_STATUS ?",
            (search_for or None,),
        )

    def get_location_slots(self) -> dict:
        return self._exec("EXEC dbo.GET_LOCATION_SLOT_LIST")

    def get_yard_3d_inventory(self) -> dict:
        return self._exec("EXEC dbo.SP_YARD_3D_INVENTORY")

    def get_yard_3d_slot_list(self) -> dict:
        return self._exec("EXEC dbo.SP_YARD_3D_SLOT_LIST")

    def get_container_info(self, container_no: str) -> dict:
        return self._exec("EXEC dbo.SP_CONTAINER_INFO ?", (container_no,))

    def update_physical_location(self, container_no: str, location: str) -> dict:
        return self._exec(
            "EXEC dbo.UPD_PHYSICAL_CONTAINER_LOCATION ?, ?",
            (container_no, location),
            commit=True,
        )

    def get_pre_gate_survey(
        self,
        plant_id: int,
        from_date: Optional[str],
        to_date: Optional[str],
        gate_name: Optional[str],
    ) -> dict:
        # Parameterized — no f-string interpolation
        return self._exec(
            "EXEC dbo.GET_ESURVEY_DETAIL @PlantID = ?, @FromDate = ?, @ToDate = ?, @ContainerNo = NULL, @GateName = ?",
            (plant_id, from_date, to_date, gate_name),
        )

    def get_container_history_report(
        self,
        from_date: Optional[str],
        to_date: Optional[str],
        container_no: Optional[str],
        plant_id: int,
    ) -> dict:
        return self._exec(
            "EXEC dbo.GET_CONT_HISTORY_REPORT @fromDate = ?, @toDate = ?, @ContNo = ?, @PlantID = ?",
            (from_date, to_date, container_no or "", plant_id),
        )

    def get_survey_gate_names(self) -> dict:
        return self._exec(
            "SELECT DISTINCT GateName FROM EKL_TRN_CONTAINER_ESURVEY "
            "WHERE GateName IS NOT NULL AND LTRIM(RTRIM(GateName)) <> '' "
            "ORDER BY GateName"
        )

    def get_daily_utilisation(self, from_date: str, to_date: str, group_by: Optional[str]) -> dict:
        return self._exec(
            "EXEC dbo.SP_DAILY_UTILISATION ?, ?, ?",
            (from_date, to_date, group_by or None),
        )

    def get_inventory_list(self) -> dict:
        return self._exec("EXEC dbo.SP_INVENTORY_LIST")

    def get_trailer_gate_in_list(self) -> dict:
        return self._exec("EXEC dbo.GET_EKL_TRN_TRAILER_LIST")

    def get_trailer_gate_out_list(self, plant_id: int, gate_type: int, user_id: str) -> dict:
        return self._exec(
            "EXEC dbo.GET_24HR_TRAILER_OUT_DETAIL @PlantID = ?, @GateType = ?, @UserID = ?",
            (plant_id, gate_type, user_id),
        )

    def find_trailer_containers(self, trailer_no: str) -> dict:
        return self._exec(
            "SELECT InContNo, OutContNo, ContainerNo FROM EKL_TRN_TRAILER "
            "WHERE TrailerNo = ? AND Isdelete = 0 AND GateOutDate IS NULL",
            (trailer_no,),
        )

    def gate_out_trailer(
        self,
        trailer_no: str,
        container_no: str,
        gate_out_by: str,
        plant_id: int,
    ) -> dict:
        # @IsSuccess is an OUTPUT param but the proc also does
        # SELECT @IsSuccess AS result, so the result set alone is enough.
        return self._exec(
            "SET NOCOUNT ON; DECLARE @Success int; "
            "EXEC dbo.UPD_TRAILER_OUT_DETAIL @TrailerNo = ?, @ContainerNo = ?, @GateOutBy = ?, @PlantID = ?, @IsSuccess = @Success OUTPUT",
            (trailer_no, container_no, gate_out_by, plant_id),
            commit=True,
        )
