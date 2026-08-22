import React, { useState } from 'react'
import { FiDownload, FiTrash2, FiPlusCircle, FiUploadCloud } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'

const mockPlanData = [
  { planName: "RailPlan_487626", from: "GHH", to: "MDPT", date: "12-12-2025 07:09", total: 76, completed: 7, pending: 69 },
  { planName: "RailPlan_487626", from: "GHH", to: "MICT", date: "12-12-2025 07:09", total: 2, completed: 0, pending: 2 },
  { planName: "RailPlan_487626", from: "GHH", to: "AMCT", date: "12-12-2025 07:09", total: 2, completed: 0, pending: 2 },
  { planName: "RailPlan_881779", from: "GHH", to: "MDPT", date: "11-12-2025 21:20", total: 84, completed: 0, pending: 84 },
  { planName: "RailPlan_992123", from: "GHH", to: "ICDT", date: "10-12-2025 14:15", total: 45, completed: 45, pending: 0 },
]

const RailPlanUpload = () => {
  const [plans, setPlans] = useState(mockPlanData)

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
                  <button className="flex items-center gap-2 text-[#0e4a78] font-bold text-sm mb-4 hover:underline self-start">
                    <FiDownload className="text-lg" />
                    Download Excel Format
                  </button>

                  <div className="flex-1 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-8 bg-slate-50 transition hover:bg-slate-100 hover:border-[#0e4a78]/50 cursor-pointer min-h-[200px]">
                    <FiUploadCloud className="text-5xl text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">Drop files here to upload</p>
                    <p className="text-xs text-slate-400 mt-2">or click to browse</p>
                  </div>

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
                      {/* Empty state or specific errors can go here */}
                      <tr>
                        <td colSpan="2" className="px-6 py-12 text-center text-slate-400 italic">
                          No validation errors found
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Rail Plan Name Table Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-3">
                <h2 className="text-lg font-semibold tracking-wide uppercase">Rail Plan Name</h2>
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
                    {plans.map((plan, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/50 transition odd:bg-white even:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-[#b51818]">{plan.planName}</td>
                        <td className="px-4 py-3 text-slate-700">{plan.from}</td>
                        <td className="px-4 py-3 text-slate-700">{plan.to}</td>
                        <td className="px-4 py-3 text-slate-700">{plan.date}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{plan.total}</td>
                        <td className="px-4 py-3 text-slate-700">{plan.completed}</td>
                        <td className="px-4 py-3 text-slate-700">{plan.pending}</td>
                        <td className="px-4 py-3">
                          <button className="bg-[#00c9e8] text-white font-bold px-3 py-1.5 rounded shadow hover:bg-[#00b0cc] transition text-[10px] uppercase tracking-wider">
                            Deactivate
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button className="text-slate-400 hover:text-red-500 transition text-lg">
                            <FiTrash2 />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button className="text-[#0e4a78] hover:text-[#0b3e66] transition text-2xl">
                            <FiPlusCircle />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default RailPlanUpload