import React from 'react'
import ReportPageTemplate from './templates/ReportPageTemplate'

const summaryCards = [
  { label: 'Total Moves', value: '2,184', trend: '+9% vs LW', trendColor: 'text-emerald-600' },
  { label: 'Rail Contribution', value: '38%', trend: '+3 pts', trendColor: 'text-blue-600' },
  { label: 'Road Contribution', value: '62%', trend: '-3 pts', trendColor: 'text-amber-600' },
  { label: 'Peak Terminal', value: 'West Yard', trend: '812 moves', trendColor: 'text-slate-500' },
]

const columns = [
  { key: 'terminal', label: 'Terminal' },
  { key: 'imports', label: 'Imports' },
  { key: 'exports', label: 'Exports' },
  { key: 'rail', label: 'Rail' },
  { key: 'road', label: 'Road' },
  { key: 'lastUpdated', label: 'Last Updated' },
]

const rows = [
  { id: 'twh-1', terminal: 'West Yard', imports: 312, exports: 500, rail: 210, road: 602, lastUpdated: '08:30' },
  { id: 'twh-2', terminal: 'North Yard', imports: 198, exports: 420, rail: 150, road: 468, lastUpdated: '08:25' },
  { id: 'twh-3', terminal: 'South Yard', imports: 165, exports: 377, rail: 118, road: 424, lastUpdated: '08:18' },
  { id: 'twh-4', terminal: 'Rail Hub', imports: 88, exports: 116, rail: 240, road: 64, lastUpdated: '08:15' },
]

const TerminalWiseContainerHandled = () => (
  <ReportPageTemplate
    title="Terminal Wise Container Handled"
    subtitle="Breakdown of import/export throughput across facilities"
    lastUpdated="15 Dec 2025 • 08:35"
    summaryCards={summaryCards}
    columns={columns}
    rows={rows}
    helperText="Trend charts and drill-down per shift will connect once BI endpoints are wired."
  />
)

export default TerminalWiseContainerHandled
