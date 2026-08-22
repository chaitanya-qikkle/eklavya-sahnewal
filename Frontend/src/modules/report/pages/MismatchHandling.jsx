import React from 'react'
import ReportPageTemplate from './templates/ReportPageTemplate'

const summaryCards = [
  { label: 'Cases Logged', value: '52', trend: '+6 vs LW', trendColor: 'text-rose-600' },
  { label: 'Assigned', value: '44', trend: '85% coverage', trendColor: 'text-blue-600' },
  { label: 'Resolved', value: '31', trend: '+5 vs target', trendColor: 'text-emerald-600' },
  { label: 'Average SLA', value: '05:10 hrs', trend: '-45 mins vs SLA', trendColor: 'text-emerald-600' },
]

const columns = [
  { key: 'caseId', label: 'Case ID' },
  { key: 'type', label: 'Type' },
  { key: 'owner', label: 'Owner' },
  { key: 'age', label: 'Age (hrs)' },
  { key: 'status', label: 'Status' },
  { key: 'action', label: 'Next Action' },
]

const rows = [
  { id: 'mh-1', caseId: 'MIS-2091', type: 'Qty mismatch', owner: 'Inventory', age: '1.5', status: 'In Progress', action: 'Recount scheduled' },
  { id: 'mh-2', caseId: 'MIS-2092', type: 'Seal variance', owner: 'Security', age: '0.8', status: 'Assigned', action: 'Photo evidence' },
  { id: 'mh-3', caseId: 'MIS-2093', type: 'Location drift', owner: 'Yard Ops', age: '4.2', status: 'Escalated', action: 'RTLS check' },
  { id: 'mh-4', caseId: 'MIS-2094', type: 'Data sync', owner: 'IT', age: '0.3', status: 'Closed', action: 'Patched' },
]

const MismatchHandling = () => (
  <ReportPageTemplate
    title="Mismatch Handling"
    subtitle="Workflow dashboard for investigations and closures"
    lastUpdated="15 Dec 2025 • 08:22"
    summaryCards={summaryCards}
    columns={columns}
    rows={rows}
    helperText="SLA timers, attachments, and comments will connect to the workflow microservice."
  />
)

export default MismatchHandling
