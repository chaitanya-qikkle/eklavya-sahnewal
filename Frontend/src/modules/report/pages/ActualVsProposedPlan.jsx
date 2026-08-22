import React from 'react'
import ReportPageTemplate from './templates/ReportPageTemplate'

const summaryCards = [
  { label: 'Planned Moves', value: '2,260', trend: '+4% vs LW', trendColor: 'text-blue-600' },
  { label: 'Actual Moves', value: '2,184', trend: '-76 vs plan', trendColor: 'text-rose-600' },
  { label: 'Variance', value: '-3.4%', trend: 'Recoverable by shift C', trendColor: 'text-amber-600' },
  { label: 'Plan Adherence', value: '96%', trend: '+1 pt vs LW', trendColor: 'text-emerald-600' },
]

const columns = [
  { key: 'planId', label: 'Plan ID' },
  { key: 'lane', label: 'Lane / Activity' },
  { key: 'proposed', label: 'Proposed' },
  { key: 'actual', label: 'Actual' },
  { key: 'variance', label: 'Variance' },
  { key: 'owner', label: 'Owner' },
]

const rows = [
  { id: 'avp-1', planId: 'PLAN-771', lane: 'Export Stuffing', proposed: 520, actual: 488, variance: '-32', owner: 'Stuffing' },
  { id: 'avp-2', planId: 'PLAN-772', lane: 'Rail Loading', proposed: 640, actual: 612, variance: '-28', owner: 'Rail Ops' },
  { id: 'avp-3', planId: 'PLAN-773', lane: 'Gate Out Road', proposed: 780, actual: 764, variance: '-16', owner: 'Gate Ops' },
  { id: 'avp-4', planId: 'PLAN-774', lane: 'Yard Rehandles', proposed: 320, actual: 320, variance: '0', owner: 'Yard Ops' },
]

const ActualVsProposedPlan = () => (
  <ReportPageTemplate
    title="Actual vs Proposed Plan"
    subtitle="Variance matrix tracking execution against the daily plan"
    lastUpdated="15 Dec 2025 • 08:45"
    summaryCards={summaryCards}
    columns={columns}
    rows={rows}
    helperText="Drill downs to root-cause templates will be added with the analytics phase."
  />
)

export default ActualVsProposedPlan
