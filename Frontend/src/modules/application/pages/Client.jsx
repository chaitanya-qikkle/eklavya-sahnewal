import { useState, useMemo } from 'react'
import { FiSearch, FiTrash2, FiEdit2, FiX, FiUsers, FiImage, FiList } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { confirmAction, notify } from '../../../utils/notify'
import {
  useGetClientAllQuery,
  useAddClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
} from '../../../store/api/clientApi'

const Client = () => {
  const [activeTab, setActiveTab] = useState('form')
  const [clientName, setClientName] = useState('')
  const [logo, setLogo] = useState(null)
  const { data: clientsResponse, refetch } = useGetClientAllQuery()
  const clients = useMemo(() => clientsResponse?.clients || [], [clientsResponse])
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState(null)

  const [addClient] = useAddClientMutation()
  const [updateClient] = useUpdateClientMutation()
  const [deleteClient] = useDeleteClientMutation()

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setLogo(file)
    }
  }

  const handleSave = () => {
    if (!clientName.trim()) {
      notify.warning('Client name required', 'Please enter client name')
      return
    }

    ;(async () => {
      try {
        const result = editingId
          ? await updateClient({ client_id: editingId, client_name: clientName.trim(), logo }).unwrap()
          : await addClient({ client_name: clientName.trim(), logo }).unwrap()

        if (result?.status !== 'success') throw new Error(result?.message || 'Operation failed')

        notify.success('Saved', editingId ? 'Client updated successfully' : 'Client created successfully')
        handleCancel()
        setActiveTab('list')
        await refetch()
      } catch (err) {
        const detail = err?.data?.detail
        const errorMsg = typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map(d => d?.msg || d?.message || JSON.stringify(d)).join(', ')
            : err?.message || 'Operation failed'
        notify.error('Save failed', errorMsg)
      }
    })()
  }

  const handleCancel = () => {
    setClientName('')
    setLogo(null)
    setEditingId(null)
    // Reset file input element
    const fileInput = document.getElementById('logo-upload')
    if (fileInput) fileInput.value = ''
  }

  const handleEdit = (client) => {
    setClientName(client.clientName || client.name || '')
    setLogo(null)
    setEditingId(client.id)
    setActiveTab('form')
    // Reset file input
    const fileInput = document.getElementById('logo-upload')
    if (fileInput) fileInput.value = ''
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete client?',
      text: 'Are you sure you want to delete this client?',
      confirmButtonText: 'Delete',
    })
    if (!confirmed) return
    try {
      const result = await deleteClient({ client_id: id }).unwrap()
      if (result?.status !== 'success') throw new Error(result?.message || 'Delete failed')
      notify.success('Deleted', 'Client deleted successfully')
      await refetch()
    } catch (err) {
      notify.error('Delete failed', err?.data?.detail || err?.message || 'Operation failed')
    }
  }

  const filteredClients = clients.filter(client =>
    (client.clientName || client.name || '').toLowerCase().includes(searchTerm.toLowerCase())
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
          <div className="w-full max-w-6xl mx-auto">

            {/* Tab Header */}
            <div className="flex gap-2 mb-0">
              <button
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-t-xl border border-b-0 transition-all ${
                  activeTab === 'form'
                    ? 'bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white border-[#0e4a78] shadow-lg'
                    : 'bg-white/80 text-slate-600 border-slate-300 hover:bg-white hover:text-[#0e4a78]'
                }`}
              >
                <FiUsers />
                {editingId ? 'Edit Client' : 'Add Client'}
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-t-xl border border-b-0 transition-all ${
                  activeTab === 'list'
                    ? 'bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white border-[#0e4a78] shadow-lg'
                    : 'bg-white/80 text-slate-600 border-slate-300 hover:bg-white hover:text-[#0e4a78]'
                }`}
              >
                <FiList />
                Clients List
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'list' ? 'bg-white/20' : 'bg-[#0e4a78]/10 text-[#0e4a78]'}`}>
                  {clients.length}
                </span>
              </button>
            </div>

            {/* Tab Content */}
            <section className="bg-white/95 rounded-b-2xl rounded-tr-2xl shadow-xl border border-slate-300 overflow-hidden">

              {/* ─── FORM TAB ─── */}
              {activeTab === 'form' && (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <FiUsers className="text-[#0e4a78]" />
                        Client Name
                      </label>
                      <input
                        type="text"
                        placeholder="Client Name"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <FiImage className="text-[#0e4a78]" />
                        Logo
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          id="logo-upload"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="logo-upload"
                          className="px-6 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer shadow-sm"
                        >
                          Choose File
                        </label>
                        <span className="text-sm text-slate-600 font-medium">
                          {logo ? logo.name : 'No file chosen'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSave}
                      className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      {editingId ? 'Update' : 'Save'}
                    </button>
                    {editingId && (
                      <button
                        onClick={() => { handleCancel(); setActiveTab('list'); }}
                        className="px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ─── LIST TAB ─── */}
              {activeTab === 'list' && (
                <div className="flex flex-col min-h-[500px]">
                  {/* Search Bar */}
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by client name..."
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
                          <th className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30">
                            <div className="flex items-center gap-2">
                              <FiUsers />
                              Client Name
                            </div>
                          </th>
                          <th className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30">
                            <div className="flex items-center gap-2">
                              <FiImage />
                              Logo
                            </div>
                          </th>
                          <th className="px-4 sm:px-5 py-3 text-center font-semibold">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredClients.length > 0 ? (
                          filteredClients.map((client) => (
                            <tr key={client.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200">
                              <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs">
                                  <FiUsers className="text-xs" />
                                  {client.clientName || client.name}
                                </span>
                              </td>
                              <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                                {client.logoPath ? (
                                  <img
                                    src={client.logoPath}
                                    alt={`${client.clientName} logo`}
                                    className="h-8 w-8 object-contain rounded"
                                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'inline'; }}
                                  />
                                ) : null}
                                <span className="text-slate-400 text-xs italic" style={{ display: client.logoPath ? 'none' : 'inline' }}>No logo</span>
                              </td>
                              <td className="px-4 sm:px-5 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleEdit(client)}
                                    className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                    title="Edit"
                                  >
                                    <FiEdit2 className="text-sm" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(client.id)}
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
                            <td colSpan="3" className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center gap-3 text-slate-400">
                                <FiSearch className="text-4xl" />
                                <p className="text-sm font-medium">No clients found</p>
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

                  {/* Footer */}
                  <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 text-sm text-slate-600 font-medium">
                    Showing <span className="text-[#0e4a78] font-bold">{filteredClients.length}</span> of <span className="text-[#0e4a78] font-bold">{clients.length}</span> entries
                  </div>
                </div>
              )}

            </section>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default Client