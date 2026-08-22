import React from 'react'
import ReportPageTemplate from './templates/ReportPageTemplate'

const summaryCards = [
  { label: 'Trains Departed', value: '4', trend: 'All on schedule', trendColor: 'text-emerald-600' },
  { label: 'In Transit', value: '3', trend: 'ETA within SLA', trendColor: 'text-blue-600' },
  { label: 'Delayed', value: '1', trend: 'Awaiting crew', trendColor: 'text-amber-600' },
  { label: 'Containers On Rail', value: '512', trend: '+48 vs LW', trendColor: 'text-emerald-600' },
]

const columns = [
  { key: 'train', label: 'Train No' },
  { key: 'origin', label: 'Origin' },
  { key: 'destination', label: 'Destination' },
  { key: 'etd', label: 'ETD' },
  { key: 'eta', label: 'ETA' },
  { key: 'status', label: 'Status' },
]

const rows = [
  { id: 'rj-1', train: 'BRC-902', origin: 'JLNPT', destination: 'Dadri', etd: '15 Dec • 06:30', eta: '16 Dec • 02:15', status: 'In Transit' },
  { id: 'rj-2', train: 'BRC-903', origin: 'JLNPT', destination: 'Nagpur', etd: '15 Dec • 04:45', eta: '15 Dec • 22:40', status: 'On Time' },
  { id: 'rj-3', train: 'BRC-904', origin: 'JLNPT', destination: 'Delhi', etd: '15 Dec • 08:00', eta: '16 Dec • 05:10', status: 'Crew Delay' },
  { id: 'rj-4', train: 'BRC-905', origin: 'JLNPT', destination: 'Ludhiana', etd: '14 Dec • 23:55', eta: '15 Dec • 18:20', status: 'Arrived' },
]

const RailJourney = () => (
  <ReportPageTemplate
    title="Rail Journey"
    subtitle="Door-to-door milestone tracking for outbound trains"
    lastUpdated="15 Dec 2025 • 08:10"
    summaryCards={summaryCards}
    columns={columns}
    rows={rows}
    helperText="Integration with Railways ETA feed will provide live MAP and telemetry overlays."
  />
)

export default RailJourney
