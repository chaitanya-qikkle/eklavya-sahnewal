import React, { useState, useRef } from 'react'
import { FiDownload, FiTrash2, FiPlusCircle, FiUploadCloud, FiX, FiRefreshCw } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import * as XLSX from 'xlsx'
import {
  useGetRailPlanListQuery,
  useLazyGetRailPlanDetailQuery,
  useRailPlanTaskMutation,
  useRailPlanAddTaskMutation,
  useRailPlanDeleteTaskMutation,
  useRailPlanUploadMutation,
} from '../../../store/api/ymsApi'

const fmtDate = (v) => {
  if (!v) return '—'
  const d = new Date(String(v).replace(' ', 'T'))
  if (isNaN(d.getTime())) return String(v)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const RailPlanUpload = () => {
  const { data: planListApi, isFetching: isPlanListFetching, refetch: refetchPlanList } = useGetRailPlanListQuery()
  const [fetchDetail, { data: detailApi, isFetching: isDetailFetching }] = useLazyGetRailPlanDetailQuery()
  const [railPlanTask, { isLoading: isTaskLoading }] = useRailPlanTaskMutation()
  const [railPlanAddTask, { isLoading: isAddTaskLoading }] = useRailPlanAddTaskMutation()
  const [railPlanDeleteTask] = useRailPlanDeleteTaskMutation()
  const [railPlanUpload, { isLoading: isUploading }] = useRailPlanUploadMutation()

  const [dragActive, setDragActive] = useState(false)
  const [uploadErrors, setUploadErrors] = useState([])
  const [uploadMessage, setUploadMessage] = useState(null)
  const fileInputRef = useRef(null)

  const [addTaskPlan, setAddTaskPlan] = useState(null)   // { RailPlanName, IsJobAllotted } | null
  const [addTaskContainer, setAddTaskContainer] = useState('')
  const [addTaskError, setAddTaskError] = useState(null)

  const [drilldownPlan, setDrilldownPlan] = useState(null) // { RailPlanName, IsJobAllotted } | null

  const plans = Array.isArray(planListApi?.data) ? planListApi.data : []
  const detailRows = Array.isArray(detailApi?.data) ? detailApi.data : []

  const handleDownloadFormat = () => {
    const ws = XLSX.utils.aoa_to_sheet([['Container No', 'Container Size', 'To Location']])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Format')
    XLSX.writeFile(wb, 'RailPlan_UploadFormat.xlsx')
  }

  const readFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
        const rows = aoa
          .filter((r, idx) => idx > 0 || String(r[0] ?? '').trim().toUpperCase() !== 'CONTAINER NO')
          .map((r) => ({
            container_no:   String(r[0] ?? '').trim().toUpperCase(),
            container_size: String(r[1] ?? '').trim(),
            to_location:    String(r[2] ?? '').trim(),
          }))
          .filter((r) => r.container_no)

        if (!rows.length) {
          setUploadMessage(null)
          setUploadErrors([{ SrNo: '-', ErrorName: 'No container rows found in the uploaded file.' }])
          return
        }

        setUploadMessage(null)
        setUploadErrors([])
        try {
          const res = await railPlanUpload(rows).unwrap()
          setUploadErrors(res?.errors || [])
          setUploadMessage(
            `Uploaded as ${res?.rail_plan_name} — ${res?.total_rows - (res?.error_count || 0)} of ${res?.total_rows} rows processed successfully.`
          )
          refetchPlanList()
        } catch (err) {
          setUploadErrors([{ SrNo: '-', ErrorName: err?.data?.detail || err?.data?.message || err?.error || 'Upload failed.' }])
        }
      } catch {
        setUploadErrors([{ SrNo: '-', ErrorName: 'Could not read the uploaded file.' }])
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleFileInput = (e) => {
    readFile(e.target.files?.[0])
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    readFile(e.dataTransfer.files?.[0])
  }

  const handleToggleActivate = async (plan) => {
    const type = plan.IsJobAllotted ? 'DEACTIVATE' : 'ACTIVATE'
    try {
      await railPlanTask({ rail_plan_name: plan.RailPlanName, type }).unwrap()
    } catch (err) {
      alert(err?.data?.detail || err?.data?.message || err?.error || 'Action failed.')
    }
  }

  const handleDeletePlan = async (plan) => {
    if (!window.confirm(`Delete rail plan "${plan.RailPlanName}"? This cannot be undone.`)) return
    try {
      await railPlanTask({ rail_plan_name: plan.RailPlanName, type: 'DELETE' }).unwrap()
    } catch (err) {
      alert(err?.data?.detail || err?.data?.message || err?.error || 'Delete failed.')
    }
  }

  const openAddTask = (plan) => {
    setAddTaskPlan(plan)
    setAddTaskContainer('')
    setAddTaskError(null)
  }

  const submitAddTask = async () => {
    if (!addTaskContainer.trim()) {
      setAddTaskError('Enter a container number.')
      return
    }
    try {
      await railPlanAddTask({
        rail_plan_name: addTaskPlan.RailPlanName,
        container_no: addTaskContainer.trim().toUpperCase(),
        is_job_allotted: !!addTaskPlan.IsJobAllotted,
      }).unwrap()
      setAddTaskPlan(null)
    } catch (err) {
      setAddTaskError(err?.data?.detail || err?.data?.message || err?.error || 'Failed to add task.')
    }
  }

  const openDrilldown = (plan) => {
    setDrilldownPlan(plan)
    fetchDetail({ rail_plan_name: plan.RailPlanName, is_job_allotted: plan.IsJobAllotted ? 1 : 0 })
  }

  const handleDeleteJob = async (jobId, planStatus) => {
    if (!window.confirm('Remove this job from the plan?')) return
    try {
      await railPlanDeleteTask({ job_id_list: [jobId], plan_status: planStatus }).unwrap()
      if (drilldownPlan) {
        fetchDetail({ rail_plan_name: drilldownPlan.RailPlanName, is_job_allotted: drilldownPlan.IsJobAllotted ? 1 : 0 })
      }
      refetchPlanList()
    } catch (err) {
      alert(err?.data?.detail || err?.data?.message || err?.error || 'Failed to delete job.')
    }
  }

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="w-full space-y-8">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Rail Plan Upload Section */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col h-full">
                <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3 flex justify-between items-center">
                  <h2 className="text-lg font-semibold tracking-wide uppercase">Rail Plan Upload</h2>
                </header>
                <div className="p-6 flex-1 flex flex-col">
                  <button
                    onClick={handleDownloadFormat}
                    className="flex items-center gap-2 text-[#0e4a78] font-bold text-sm mb-4 hover:underline self-start"
                  >
                    <FiDownload className="text-lg" />
                    Download Excel Format
                  </button>

                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition cursor-pointer min-h-[200px]
                      ${dragActive ? 'border-[#0e4a78] bg-[#eaf1f7]' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-[#0e4a78]/50'}`}
                  >
                    {isUploading
                      ? <FiRefreshCw className="text-5xl text-[#0e4a78] mb-4 animate-spin" />
                      : <FiUploadCloud className="text-5xl text-slate-300 mb-4" />
                    }
                    <p className="text-slate-500 font-medium">{isUploading ? 'Uploading…' : 'Drop files here to upload'}</p>
                    {!isUploading && <p className="text-xs text-slate-400 mt-2">or click to browse</p>}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xls,.xlsx"
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </div>

                  {uploadMessage && (
                    <p className="text-emerald-600 font-semibold text-xs mt-4">{uploadMessage}</p>
                  )}

                  <p className="text-[#a81414] font-bold text-xs uppercase mt-4 tracking-wide">
                    Upload only XLS/XLSX file
                  </p>
                </div>
              </section>

              {/* View Error List Section */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col h-full">
                <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3">
                  <h2 className="text-lg font-semibold tracking-wide uppercase">View Error List</h2>
                </header>
                <div className="p-0 flex-1 overflow-auto">
                  <table className="min-w-full text-xs md:text-sm text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                        <th className="px-4 sm:px-5 py-3 font-semibold w-24 border-r border-white/30">SR NO</th>
                        <th className="px-4 sm:px-5 py-3 font-semibold border-r border-white/30 last:border-r-0">ERROR NAME</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {uploadErrors.length === 0 ? (
                        <tr>
                          <td colSpan="2" className="px-6 py-12 text-center text-slate-400 italic">
                            No validation errors found
                          </td>
                        </tr>
                      ) : (
                        uploadErrors.map((err, idx) => (
                          <tr key={idx} className="odd:bg-white even:bg-slate-50/50">
                            <td className="px-4 sm:px-5 py-3 text-slate-700">{err.SrNo ?? idx + 1}</td>
                            <td className="px-4 sm:px-5 py-3 text-red-600 font-medium">{err.ErrorName}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Rail Plan Name Table Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-wide uppercase">Rail Plan Name</h2>
                <button onClick={() => refetchPlanList()} className="text-white/80 hover:text-white">
                  <FiRefreshCw className={isPlanListFetching ? 'animate-spin' : ''} />
                </button>
              </header>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                      {[
                        'Plan Name', 'From Location', 'To Location', 'Plan Date', 'Total', 'Completed Task', 'Pending Task', 'Action', 'Delete', 'Add Task'
                      ].map((header, idx) => (
                        <th key={idx} className="px-4 sm:px-5 py-3 font-semibold uppercase tracking-wider whitespace-nowrap border-r border-white/30 last:border-r-0">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {isPlanListFetching ? (
                      <tr>
                        <td colSpan="10" className="px-6 py-12 text-center text-slate-400">
                          <FiRefreshCw className="inline animate-spin mr-2" /> Loading rail plans…
                        </td>
                      </tr>
                    ) : plans.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="px-6 py-12 text-center text-slate-400 italic">
                          No rail plans found.
                        </td>
                      </tr>
                    ) : (
                      plans.map((plan, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/50 transition odd:bg-white even:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold text-[#b51818]">
                            <button onClick={() => openDrilldown(plan)} className="hover:underline">
                              {plan.RailPlanName}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{plan.FromLocation ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{plan.ToLocation ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{fmtDate(plan.RailPlanDate)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{plan.TotalJob ?? 0}</td>
                          <td className="px-4 py-3 text-slate-700">{plan.CompletedJob ?? 0}</td>
                          <td className="px-4 py-3 text-slate-700">{plan.InCompletedJob ?? 0}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleToggleActivate(plan)}
                              disabled={isTaskLoading}
                              className="bg-[#00c9e8] text-white font-bold px-3 py-1.5 rounded shadow hover:bg-[#00b0cc] transition text-[10px] uppercase tracking-wider disabled:opacity-50"
                            >
                              {plan.IsJobAllotted ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDeletePlan(plan)}
                              className="text-slate-400 hover:text-red-500 transition text-lg"
                            >
                              <FiTrash2 />
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => openAddTask(plan)}
                              className="text-[#0e4a78] hover:text-[#0b3e66] transition text-2xl"
                            >
                              <FiPlusCircle />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

          </div>
        </main>

        <Footer />
      </div>

      {/* Add Task Modal */}
      {addTaskPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-base">Add Task — {addTaskPlan.RailPlanName}</h3>
              <button onClick={() => setAddTaskPlan(null)} className="text-white/80 hover:text-white">
                <FiX />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">Container No</label>
                <input
                  type="text"
                  value={addTaskContainer}
                  onChange={(e) => setAddTaskContainer(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && submitAddTask()}
                  placeholder="Enter container number"
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm"
                  autoFocus
                />
              </div>
              {addTaskError && <p className="text-red-500 text-xs font-semibold">{addTaskError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setAddTaskPlan(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAddTask}
                  disabled={isAddTaskLoading}
                  className="px-5 py-2 rounded-lg bg-[#0e4a78] text-white text-sm font-bold hover:bg-[#0a3b61] disabled:opacity-60"
                >
                  {isAddTaskLoading ? 'Adding…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drilldown Modal */}
      {drilldownPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-base">{drilldownPlan.RailPlanName} — Jobs</h3>
              <button onClick={() => setDrilldownPlan(null)} className="text-white/80 hover:text-white">
                <FiX />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    {['Job Type', 'Container No', 'Size', 'Location', 'Process', 'Created', 'Completed', 'Trailer No', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isDetailFetching ? (
                    <tr><td colSpan="9" className="px-8 py-12 text-center text-slate-400">
                      <FiRefreshCw className="inline animate-spin mr-2" /> Loading jobs…
                    </td></tr>
                  ) : detailRows.length === 0 ? (
                    <tr><td colSpan="9" className="px-8 py-12 text-center text-slate-400">No jobs found.</td></tr>
                  ) : (
                    detailRows.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.JobType ?? '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">{row.ContainerNo ?? '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.ContainerSize ?? '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.ContainerLocationName ?? '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.Process ?? '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{fmtDate(row.JobCreation)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.JobCompletionDate ? fmtDate(row.JobCompletionDate) : '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.TrailerNo ?? '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleDeleteJob(row.JobID, row.PlanStatus)}
                            className="text-slate-400 hover:text-red-500 transition"
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RailPlanUpload
