import React from "react";
import {
  FiPackage, FiActivity, FiClock, FiTrendingUp,
  FiLogIn, FiLogOut,
} from "react-icons/fi";
import { T } from "./theme";
import { KpiTile } from "./primitives";

export default function KpiStrip({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
      <KpiTile icon={FiPackage}    value={stats.total.toLocaleString()} label="Total Containers" accent={T.cyan} />
      <KpiTile icon={FiActivity}   value={`${stats.occupancy}%`}        label="Occupancy"        accent={T.emerald} />
      <KpiTile icon={FiClock}      value={stats.overdwell}              label=">7 Day Dwell"     accent={T.amber} />
      <KpiTile icon={FiTrendingUp} value={`${stats.avgDwellDays}d`}     label="Avg Dwell"        accent={T.indigo} />
      <KpiTile icon={FiLogIn}      value={stats.gateInToday}            label="Gate-in Today"    accent={T.blue} />
      <KpiTile icon={FiLogOut}     value={stats.gateOutToday}           label="Gate-out Today"   accent={T.purple} />
    </div>
  );
}
