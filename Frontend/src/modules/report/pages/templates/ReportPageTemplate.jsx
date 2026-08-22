import React from 'react'
import Navbar from '../../../../components/layout/Navbar'
import Footer from '../../../../components/layout/Footer'

// Report Page Template Component
// This template provides consistent styling for all report pages
const ReportPageTemplate = ({
  title,
  subtitle,
  summaryCards = [],
  columns = [],
  rows = [],
  emptyMessage = 'No records available',
  helperText,
  lastUpdated,
}) => (
  <div
    className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
    style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
  >
    {/* Background overlay for better readability */}
    <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />

    <div className="relative z-10 flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full space-y-6">

          {/* Main Content Section */}
          <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">

            {/* Header Section with gradient background */}
            <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between shadow-md">
              <div>
                <h1 className="text-2xl font-bold tracking-wide">{title}</h1>
                <p className="text-white/80 mt-1">{subtitle}</p>
              </div>
              {lastUpdated && (
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                  Updated {lastUpdated}
                </p>
              )}
            </div>

            {/* Summary Cards Section */}
            {summaryCards.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-6 py-6 bg-slate-50/50 border-b border-slate-200">
                {summaryCards.map((card) => (
                  <div
                    key={card.label}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {card.label}
                    </p>
                    <p className="text-3xl font-bold text-slate-800 mt-2">
                      {card.value}
                    </p>
                    {card.trend && (
                      <p className={`text-sm font-medium mt-2 ${card.trendColor || 'text-emerald-600'}`}>
                        {card.trend}
                      </p>
                    )}
                    {card.caption && (
                      <p className="text-xs text-slate-400 mt-2">{card.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Table Section */}
            <div className="px-6 py-6 space-y-4">
              {helperText && (
                <p className="text-sm text-slate-600 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  {helperText}
                </p>
              )}

              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  {columns.length > 0 && (
                    <thead className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] sticky top-0">
                      <tr>
                        {columns.map((column) => (
                          <th
                            key={column.key}
                            className="px-5 py-4 text-left text-xs font-bold text-white uppercase tracking-wide border-r border-white/10 last:border-r-0"
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {rows.length > 0 ? (
                      rows.map((row, rowIndex) => (
                        <tr
                          key={row.id || `${row[columns[0]?.key] || 'row'}-${rowIndex}`}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          {columns.map((column) => (
                            <td
                              key={column.key}
                              className="px-5 py-4 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0"
                            >
                              {row[column.key]}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={Math.max(columns.length, 1)}
                          className="px-6 py-12 text-center text-slate-500 italic"
                        >
                          {emptyMessage}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  </div>
)

export default ReportPageTemplate
