import React, { useState, useEffect } from 'react'
import { FiSearch, FiTrash2, FiEdit2, FiX, FiAnchor, FiUser, FiPhone, FiMail, FiCode, FiCheckCircle, FiXCircle } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { confirmAction, notify } from '../../../utils/notify'
import { API_ENDPOINTS } from '../../../config/api'

const Line = () => {
  const [lineCode, setLineCode] = useState('')
  const [lineName, setLineName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactNo, setContactNo] = useState('')
  const [emailId, setEmailId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [lines, setLines] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Fetch Lines on Mount
  useEffect(() => {
    fetchLines()
  }, [])

  

  const fetchLines = async () => {
    setIsLoading(true)
    try {
      const token = sessionStorage.getItem('authToken')
      const response = await fetch(API_ENDPOINTS.MASTER.GET_LINE, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()

      if (data && data.data) {
        const mappedLines = data.data.map(item => ({
          id: item.LINE_ID || item.line_id || item.id,
          lineCode: item.LINE_CODE || item.line_code || '',
          lineName: item.LINE_NAME || item.line_name || '',
          contactPerson: item.CONTACT_PERSON || item.contact_person || '',
          contactNo: item.CONTACT_NO || item.contact_no || '',
          emailId: item.EMAIL_ID || item.email_id || '',
          isActive: item.IS_ACTIVE === true || item.IS_ACTIVE === 1 || item.is_active === 1
        }))
        setLines(mappedLines)
      }
    } catch (error) {
      notify.error('Error', 'Failed to fetch lines')
    } finally {
      setIsLoading(false)
    }
  }

const handleSave = async () => {
  if (!lineCode || !lineName) {
    notify.error('Validation', 'Line Code & Line Name required')
    return
  }

  try {
    const token = sessionStorage.getItem('authToken')

    const formData = {
  line_code: lineCode,
  line_name: lineName,
  contact_person: contactPerson || '',
  contact_no: contactNo || '',
  email_id: emailId || '',
  is_active: isActive ? true : false,
  created_by: 1   // ✅ added
};


    const response = await fetch(API_ENDPOINTS.MASTER.ADD_LINE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })

    const data = await response.json()

    if (!response.ok || data?.status === 'error') {
      throw new Error(data?.message || 'Add failed')
    }

    notify.success('Success', 'Line added successfully')
    handleCancel()
    fetchLines()

  } catch (error) {
    console.error(error)
    notify.error('Error', error.message)
  }
}

  const handleUpdate = async () => {
    if (!lineCode || !lineName) {
      notify.error('Validation', 'Line Code & Line Name required')
      return
    }

    console.log('Updating line with ID:', editingId);
    try {
      const token = sessionStorage.getItem('authToken')

      const formData = {
        line_id: editingId,
        line_code: lineCode,
        line_name: lineName,
        contact_person: contactPerson || '',
        contact_no: contactNo || '',
        email_id: emailId || '',
        is_active: isActive ? true : false,
        modified_by: 1
      }

      const response = await fetch(API_ENDPOINTS.MASTER.UPDATE_LINE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Update failed')
      }

      notify.success('Success', 'Line updated successfully')
      handleCancel()
      fetchLines()

    } catch (error) {
      console.error(error)
      notify.error('Error', error.message)
    }
  }

  const handleCancel = () => {
    setLineCode('')
    setLineName('')
    setContactPerson('')
    setContactNo('')
    setEmailId('')
    setIsActive(true)
    setEditingId(null)
  }

  const handleEdit = (line) => {
    setLineCode(line.lineCode)
    setLineName(line.lineName)
    setContactPerson(line.contactPerson)
    setContactNo(line.contactNo)
    setEmailId(line.emailId)
    setIsActive(line.isActive)
    setEditingId(line.id)
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete line?',
      text: 'Are you sure you want to delete this shipping line?',
      confirmButtonText: 'Delete',
    })
    if (!confirmed) return
    setLines(lines.filter(l => l.id !== id))
    notify.success('Deleted', 'Line deleted successfully')
  }
  
  const filteredLines = lines.filter(line =>
    line.lineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    line.lineCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    line.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
    line.emailId.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredLines.length / pageSize)
  const paginatedData = filteredLines.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="w-full space-y-6">

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Left Panel - Line Master Form */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
                <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FiAnchor className="text-2xl" />
                    <h2 className="text-xl font-semibold tracking-wide">
                      {editingId ? 'EDIT LINE' : 'LINE MASTER'}
                    </h2>
                  </div>
                </header>
                <div className="p-6 space-y-5">
                  {/* Line Code */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FiCode className="text-[#0e4a78]" />
                      Line Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., MSC, MAERSK"
                      value={lineCode}
                      onChange={(e) => setLineCode(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  {/* Line Name */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FiAnchor className="text-[#0e4a78]" />
                      Line Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Full shipping line name"
                      value={lineName}
                      onChange={(e) => setLineName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  {/* Contact Person */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FiUser className="text-[#0e4a78]" />
                      Contact Person
                    </label>
                    <input
                      type="text"
                      placeholder="Contact person name"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  {/* Contact Number */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FiPhone className="text-[#0e4a78]" />
                      Contact Number
                    </label>
                    <input
                      type="text"
                      placeholder="+91-9876543210"
                      value={contactNo}
                      onChange={(e) => setContactNo(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  {/* Email ID */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FiMail className="text-[#0e4a78]" />
                      Email ID
                    </label>
                    <input
                      type="email"
                      placeholder="contact@example.com"
                      value={emailId}
                      onChange={(e) => setEmailId(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  {/* Is Active */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                      {isActive ? <FiCheckCircle className="text-green-600" /> : <FiXCircle className="text-red-600" />}
                      Status
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="isActive"
                          checked={isActive === true}
                          onChange={() => setIsActive(true)}
                          className="w-4 h-4 text-[#0e4a78] focus:ring-[#0e4a78]"
                        />
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                          <FiCheckCircle className="text-green-600" />
                          Active
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="isActive"
                          checked={isActive === false}
                          onChange={() => setIsActive(false)}
                          className="w-4 h-4 text-[#0e4a78] focus:ring-[#0e4a78]"
                        />
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                          <FiXCircle className="text-red-600" />
                          Inactive
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={editingId ? handleUpdate : handleSave}
                      className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      {editingId ? 'Update' : 'Save'}
                    </button>
                  </div>
                </div>
              </section>

              {/* Right Panel - View Line Table */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col">
                <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FiAnchor className="text-2xl" />
                    <h2 className="text-xl font-semibold tracking-wide">VIEW LINES</h2>
                  </div>
                </header>

                {/* Search Bar */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by line name, code, contact person, or email..."
                      className="w-full pl-10 pr-10 py-2.5 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#0e4a78] focus:ring-2 focus:ring-[#0e4a78]/20 text-sm transition-all"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      >
                        <FiX />
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                  <table className="min-w-full text-xs md:text-sm text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                        <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">
                          <div className="flex items-center gap-2">
                            <FiCode className="text-xs" />
                            Code
                          </div>
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">
                          <div className="flex items-center gap-2">
                            <FiAnchor className="text-xs" />
                            Line Name
                          </div>
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">
                          <div className="flex items-center gap-2">
                            <FiUser className="text-xs" />
                            Contact
                          </div>
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">
                          <div className="flex items-center gap-2">
                            <FiPhone className="text-xs" />
                            Phone
                          </div>
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-center font-semibold border-r border-white/30">
                          Status
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-center font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {paginatedData.length > 0 ? (
                        paginatedData.map((line) => (
                          <tr key={line.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200">
                            <td className="px-3 sm:px-4 py-3 text-slate-700 border-r border-slate-200">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                                {line.lineCode}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-slate-700 border-r border-slate-200 font-medium">
                              {line.lineName}
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-slate-700 border-r border-slate-200">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">{line.contactPerson || '-'}</span>
                                {line.emailId && (
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <FiMail className="text-[10px]" />
                                    {line.emailId}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-slate-700 border-r border-slate-200">
                              {line.contactNo || '-'}
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-center border-r border-slate-200">
                              {line.isActive ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold text-xs">
                                  <FiCheckCircle className="text-[10px]" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold text-xs">
                                  <FiXCircle className="text-[10px]" />
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEdit(line)}
                                  className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                  title="Edit"
                                >
                                  <FiEdit2 className="text-sm" />
                                </button>
                                <button
                                  onClick={() => handleDelete(line.id)}
                                  className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                  title="Delete"
                                >
                                  <FiTrash2 className="text-sm" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3 text-slate-400">
                              <FiSearch className="text-4xl" />
                              <p className="text-sm font-medium">No shipping lines found</p>
                              {searchTerm && (
                                <button
                                  onClick={() => setSearchTerm('')}
                                  className="text-xs text-[#0e4a78] hover:underline"
                                >
                                  Clear search
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer with Pagination */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600 font-medium">
                  <div>
                    Showing <span className="text-[#0e4a78] font-bold">{Math.min((currentPage - 1) * pageSize + 1, filteredLines.length)}</span> to <span className="text-[#0e4a78] font-bold">{Math.min(currentPage * pageSize, filteredLines.length)}</span> of <span className="text-[#0e4a78] font-bold">{filteredLines.length}</span> entries
                  </div>
                  {totalPages > 1 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg border-2 border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#0e4a78] font-semibold text-xs transition-all"
                      >
                        Previous
                      </button>
                      <button className="px-3 py-1.5 rounded-lg border-2 bg-[#0e4a78] text-white border-[#0e4a78] text-xs font-bold">
                        {currentPage}
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-lg border-2 border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#0e4a78] font-semibold text-xs transition-all"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </section>

            </div>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default Line 