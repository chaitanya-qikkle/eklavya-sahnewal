import React, { useState, useEffect } from 'react'
import { FiSearch, FiTrash2, FiEdit2, FiX, FiUsers, FiCheckCircle, FiXCircle } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { confirmAction, notify } from '../../../utils/notify'
import { API_ENDPOINTS } from '../../../config/api'

const ManageCustomer = () => {
  const [customerCode, setCustomerCode] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerType, setCustomerType] = useState('')
  const [gstNo, setGstNo] = useState('')
  const [address, setAddress] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactNo, setContactNo] = useState('')
  const [emailId, setEmailId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const [activeTab, setActiveTab] = useState('view')

  useEffect(() => {
    fetchCustomers()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const fetchCustomers = async () => {
    setIsLoading(true)
    try {
      const token = sessionStorage.getItem('authToken')
      const response = await fetch(API_ENDPOINTS.MASTER.GET_CUSTOMER, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()

      console.log('Customer API Response:', data)

      if (data && data.data) {
        console.log('First customer item (raw):', data.data[0]) // Debug: see actual field names
        
        const mappedCustomers = data.data
          .map((item, index) => {
            const mapped = {
              id: item.CustomerID || item.CUSTOMER_ID || item.customer_id || item.id || item.ID || index,
              customerCode: item.CustomerCode || item.CUSTOMER_CODE || item.customer_code || '',
              customerName: item.CustomerName || item.CUSTOMER_NAME || item.customer_name || '',
              customerType: item.CustomerType || item.CUSTOMER_TYPE || item.customer_type || '',
              gstNo: item.GSTNo || item.GST_NO || item.gst_no || item.GSTNO || item.gstno || '',
              address: item.Address || item.ADDRESS || item.address || '',
              contactPerson: item.ContactPerson || item.CONTACT_PERSON || item.contact_person || '',
              contactNo: item.ContactNo || item.CONTACT_NO || item.contact_no || '',
              emailId: item.EmailID || item.EMAIL_ID || item.email_id || item.Email || item.EMAIL || item.email || '',
              isActive: item.IS_ACTIVE === true || item.IS_ACTIVE === 1 || 
                        item.IsActive === true || item.IsActive === 1 || 
                        item.is_active === true || item.is_active === 1
            }
            
            if (index === 0) console.log('First mapped customer:', mapped) // Debug
            return mapped
          })
          // Removed .filter(customer => customer.isActive) to show all customers

        console.log('Mapped Customers (all):', mappedCustomers)
        console.log('Total customers:', data.data.length, 'Active customers:', mappedCustomers.length)
        setCustomers(mappedCustomers)
      }
    } catch (error) {
      console.error('Fetch customers error:', error)
      notify.error('Error', 'Failed to fetch customers')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!customerCode || !customerName) {
      notify.error('Validation', 'Customer Code and Name are required')
      return
    }

    try {
      const token = sessionStorage.getItem('authToken')
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      const userId = user?.user_id || user?.USER_ID || user?.id || 1

      const formData = {
        customer_code: customerCode,
        customer_name: customerName,
        customer_type: customerType || null,
        gst_no: gstNo || null,
        address: address || null,
        contact_person: contactPerson || null,
        contact_no: contactNo || null,
        email_id: emailId || null,
        is_active: true,
        created_by: userId
      }

      console.log('Adding customer:', formData)

      const response = await fetch(API_ENDPOINTS.MASTER.ADD_CUSTOMER, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      console.log('Add customer response:', data)

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Add failed')
      }

      notify.success('Success', 'Customer added successfully')
      handleCancel()
      await fetchCustomers()
      setActiveTab('view')
    } catch (error) {
      console.error('Add customer error:', error)
      notify.error('Error', error.message || 'Failed to add customer')
    }
  }

  const handleUpdate = async () => {
    if (!customerCode || !customerName) {
      notify.error('Validation', 'Customer Code and Name are required')
      return
    }

    try {
      const token = sessionStorage.getItem('authToken')
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      const userId = user?.user_id || user?.USER_ID || user?.id || 1

      const formData = {
        customer_id: editingId,
        customer_code: customerCode,
        customer_name: customerName,
        customer_type: customerType || null,
        gst_no: gstNo || null,
        address: address || null,
        contact_person: contactPerson || null,
        contact_no: contactNo || null,
        email_id: emailId || null,
        is_active: isActive,
        modified_by: userId
      }

      console.log('Updating customer:', formData)

      const response = await fetch(API_ENDPOINTS.MASTER.UPDATE_CUSTOMER, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      console.log('Update customer response:', data)

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Update failed')
      }

      notify.success('Success', 'Customer updated successfully')
      handleCancel()
      await fetchCustomers()
      setActiveTab('view')
    } catch (error) {
      console.error('Update customer error:', error)
      notify.error('Error', error.message || 'Failed to update customer')
    }
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete customer?',
      text: 'Are you sure you want to delete this customer?',
      confirmButtonText: 'Delete',
    })
    if (!confirmed) return

    try {
      const token = sessionStorage.getItem('authToken')
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      const userId = user?.user_id || user?.USER_ID || user?.id || 1

      const response = await fetch(API_ENDPOINTS.MASTER.DELETE_CUSTOMER, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          customer_id: id,
          modified_by: userId
        })
      })

      const data = await response.json()

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Delete failed')
      }

      notify.success('Deleted', 'Customer deleted successfully')
      fetchCustomers()
    } catch (error) {
      console.error('Delete customer error:', error)
      notify.error('Error', error.message || 'Failed to delete customer')
    }
  }

  const handleEdit = (customer) => {
    setCustomerCode(customer.customerCode)
    setCustomerName(customer.customerName)
    setCustomerType(customer.customerType)
    setGstNo(customer.gstNo)
    setAddress(customer.address)
    setContactPerson(customer.contactPerson)
    setContactNo(customer.contactNo)
    setEmailId(customer.emailId)
    setIsActive(customer.isActive)
    setEditingId(customer.id)
    setActiveTab('add')
  }

  const handleCancel = () => {
    setCustomerCode('')
    setCustomerName('')
    setCustomerType('')
    setGstNo('')
    setAddress('')
    setContactPerson('')
    setContactNo('')
    setEmailId('')
    setIsActive(true)
    setEditingId(null)
  }

  const filteredCustomers = customers.filter(customer =>
    customer.customerCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.gstNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.contactPerson || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredCustomers.length / pageSize)
  const paginatedData = filteredCustomers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const customerForm = (
    <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
      <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
        <div className="flex items-center gap-3">
          <FiUsers className="text-2xl" />
          <h2 className="text-xl font-semibold tracking-wide">
            {editingId ? 'EDIT CUSTOMER' : 'CUSTOMER MASTER'}
          </h2>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer Code */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              Customer Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., CUST001"
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
              className="customer-input w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Customer Name */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., ABC Corporation"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="customer-input w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Customer Type */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Customer Type</label>
            <input
              type="text"
              placeholder="e.g., Corporate"
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
              className="customer-input w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* GST No */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">GST No</label>
            <input
              type="text"
              placeholder="e.g., 27AABCU9603R1ZM"
              value={gstNo}
              onChange={(e) => setGstNo(e.target.value)}
              className="customer-input w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Contact Person */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Contact Person</label>
            <input
              type="text"
              placeholder="e.g., John Doe"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="customer-input w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Contact No */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Contact No</label>
            <input
              type="text"
              placeholder="e.g., +91 9876543210"
              value={contactNo}
              onChange={(e) => setContactNo(e.target.value)}
              className="customer-input w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Email ID */}
          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700">Email ID</label>
            <input
              type="email"
              placeholder="e.g., contact@example.com"
              value={emailId}
              onChange={(e) => setEmailId(e.target.value)}
              className="customer-input w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Address */}
          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700">Address</label>
            <textarea
              placeholder="Enter address..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows="2"
              className="customer-input w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all resize-none"
            />
          </div>

          {/* Is Active - Only show when editing */}
          {editingId && (
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
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
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleCancel}
            className="flex-1 px-6 py-2.5 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={editingId ? handleUpdate : handleSave}
            className="flex-1 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {editingId ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  )

  const customerTable = (
    <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col">
      <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
        <div className="flex items-center gap-3">
          <FiUsers className="text-2xl" />
          <h2 className="text-xl font-semibold tracking-wide">VIEW CUSTOMERS</h2>
        </div>
      </header>

      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by code, name, GST or contact..."
            className="customer-input w-full pl-10 pr-10 py-2.5 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#0e4a78] focus:ring-2 focus:ring-[#0e4a78]/20 text-sm transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              aria-label="Clear search"
            >
              <FiX />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4 flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="customer-table min-w-full text-xs md:text-sm text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Code</th>
                <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Name</th>
                <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Type</th>
                <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">GST No</th>
                <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Address</th>
                <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Contact Person</th>
                <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Contact No</th>
                <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Email</th>
                <th className="px-3 sm:px-4 py-3 text-center font-semibold border-r border-white/30">Status</th>
                <th className="px-3 sm:px-4 py-3 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedData.length > 0 ? (
                paginatedData.map((customer, index) => (
                  <tr
                    key={customer.id || `customer-${index}`}
                    className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200 ${!customer.isActive ? 'opacity-60 bg-slate-50' : ''}`}
                  >
                    <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 font-medium">{customer.customerCode}</td>
                    <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 font-medium">{customer.customerName}</td>
                    <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 text-xs">{customer.customerType || '-'}</td>
                    <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 text-xs">{customer.gstNo || '-'}</td>
                    <td
                      className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 text-xs max-w-[150px] truncate"
                      title={customer.address}
                    >
                      {customer.address || '-'}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 text-xs">{customer.contactPerson || '-'}</td>
                    <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 text-xs">{customer.contactNo || '-'}</td>
                    <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 text-xs max-w-[120px] break-words leading-tight">{customer.emailId || '-'}</td>
                    <td className="px-3 sm:px-4 py-3 text-center border-r border-slate-200">
                      {customer.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                          <FiCheckCircle className="text-sm" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                          <FiXCircle className="text-sm" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                          title="Edit"
                        >
                          <FiEdit2 className="text-sm" />
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
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
                  <td colSpan="10" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <FiSearch className="text-4xl" />
                      <p className="text-sm font-medium">No customers found</p>
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

        <div className="px-0 py-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-600">
          <div>
            Showing <strong className="text-[#0e4a78]">{Math.min((currentPage - 1) * 10 + 1, filteredCustomers.length)} to {Math.min(currentPage * 10, filteredCustomers.length)}</strong> of{' '}
            <strong className="text-[#0e4a78]">{filteredCustomers.length}</strong> total records (Page{' '}
            <strong>{currentPage}</strong> of <strong>{totalPages || 1}</strong>)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                currentPage === 1
                  ? 'text-slate-400 cursor-not-allowed bg-slate-100'
                  : 'text-[#0e4a78] hover:bg-blue-50'
              }`}
            >
              Previous
            </button>

            <div className="flex items-center gap-2">
              <span className="text-slate-600">Page</span>
              <input
                type="number"
                min={1}
                max={totalPages || 1}
                value={currentPage}
                onChange={(e) => {
                  const p = Math.max(1, Math.min(totalPages || 1, Number(e.target.value) || 1))
                  setCurrentPage(p)
                }}
                className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-[#0e4a78]"
              />
              <span className="text-slate-600">of {totalPages || 1}</span>
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages || 1, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                currentPage === totalPages || totalPages === 0
                  ? 'text-slate-400 cursor-not-allowed bg-slate-100'
                  : 'text-[#0e4a78] hover:bg-blue-50'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
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

            {/* Tab Navigation */}
            <div className="flex gap-2 bg-white/95 rounded-xl p-2 shadow-lg border border-slate-300 w-fit">
              <button
                onClick={() => setActiveTab('view')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === 'view'
                    ? 'bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white shadow-lg'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FiSearch />
                  View Customers
                </div>
              </button>
              <button
                onClick={() => setActiveTab('add')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === 'add'
                    ? 'bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white shadow-lg'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FiUsers />
                  {editingId ? 'Edit Customer' : 'Add Customers'}
                </div>
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'view' && customerTable}

            {activeTab === 'add' && (
              <div className="max-w-4xl mx-auto">
                {customerForm}
              </div>
            )}

          </div>
        </main>

        <Footer />
      </div>
      
      <style>{`
        .customer-input {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          background-color: #ffffff !important;
          font-weight: 500 !important;
        }
        
        .customer-input::placeholder {
          color: #94a3b8 !important;
          -webkit-text-fill-color: #94a3b8 !important;
          opacity: 1 !important;
        }
        
        .customer-table td {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
      `}</style>
    </div>
  )
}

export default ManageCustomer
