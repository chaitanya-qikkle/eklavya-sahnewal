"""
Reports repository — DB calls for all report endpoints.
"""
from typing import Optional

from app.repositories.base import BaseRepository


class ReportsRepository(BaseRepository):

    def get_gate_report(
        self,
        from_date: str,
        to_date: str,
        container_no: str,
    ) -> dict:
        return self._exec(
            "EXEC [dbo].[RPT_GATE_INOUT] @fromDate = ?, @toDate = ?, @ContainerNo = ?",
            (from_date, to_date, container_no),
        )

    def get_device_lock_report(
        self,
        report_type: str,
        equipment_names: str,
        from_date: str,
        to_date: str,
        plant_id: int,
        location: str,
    ) -> dict:
        return self._exec(
            "EXEC [dbo].[GET_DEVICE_LOCK_REPORT] ?, ?, ?, ?, ?, ?",
            (report_type, equipment_names, from_date, to_date, plant_id, location),
        )

    def get_device_raw_data(
        self,
        plant_id: int,
        from_date: str,
        to_date: str,
        machine: str,
    ) -> dict:
        return self._exec(
            "EXEC dbo.GET_RPT_RAW_DEVICE_DATA @PlantId = ?, @FromDate = ?, @Todate = ?, @KalmarNo = ?",
            (plant_id, from_date, to_date, machine),
        )

    def get_device_raw_data_kalmar_list(self) -> dict:
        # KalmarNo values in the raw device feed don't reliably match ESS_MST_EQUIPMENT names/codes,
        # so the machine filter dropdown sources its options directly from this table.
        return self._exec(
            "SELECT DISTINCT KalmarNo FROM EKL_TRN_EKDEVICEDATA "
            "WHERE KalmarNo IS NOT NULL AND LTRIM(RTRIM(KalmarNo)) <> '' "
            "ORDER BY KalmarNo"
        )

    def update_device_container(
        self,
        plant_id: int,
        eqp_trans_id: int,
        cont_no: str,
        user_id: int,
    ) -> dict:
        return self._exec(
            "EXEC [dbo].[UPD_DEVICEDATADETAIL_CONTNO_BY_IMG] ?, ?, ?, ?",
            (plant_id, eqp_trans_id, cont_no, user_id),
            commit=True,
        )

    def get_daily_utilisation(self, sql: str, params: tuple) -> dict:
        return self._exec(sql, params)
