import React, { useState, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import {
  useGetProcessQuery,
  useAddProcessMutation,
  useUpdateProcessMutation,
  useDeleteProcessMutation
} from '../../../store/api/ymsApi';
import { notify, confirmAction } from '../../../utils/notify';
import { getStoredUser } from '../../../services/authService';
import Navbar from '../../../components/layout/Navbar';
import { 
  FiSettings, 
  FiSearch, 
  FiPlus, 
  FiEdit2, 
  FiTrash2, 
  FiX, 
  FiSave,
  FiCheckCircle,
  FiXCircle,
  FiArrowLeft,
  FiArrowRight
} from 'react-icons/fi';

const normalizeProcessRow = (row) => ({
  id: row?.ProcessID || row?.process_id,
  processCode: row?.ProcessCode || row?.process_code || '',
  processName: row?.ProcessName || row?.process_name || '',
  processCategory: row?.ProcessCategory || row?.process_category || '',
  sortOrder: row?.SortOrder || row?.sort_order || 0,
  isActive: row?.IsActive === true || row?.IsActive === 1 || row?.is_active === 1 || row?.is_active === true,
  createdOn: row?.CreatedOn || row?.created_on
});

const ManageProcess = () => {
  const { data: processData, isLoading, refetch } = useGetProcessQuery();
  const [addProcess] = useAddProcessMutation();
  const [updateProcess] = useUpdateProcessMutation();
  const [deleteProcess] = useDeleteProcessMutation();

  // Form States
  const [processCode, setProcessCode] = useState('');
  const [processName, setProcessName] = useState('');
  const [processCategory, setProcessCategory] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState(null);

  // Search & Pagination States
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleEdit = (item) => {
    setEditingId(item.id);
    setProcessCode(item.processCode);
    setProcessName(item.processName);
    setProcessCategory(item.processCategory);
    setSortOrder(item.sortOrder);
    setIsActive(item.isActive);
  };

  const handleCancel = () => {
    setEditingId(null);
    setProcessCode('');
    setProcessName('');
    setProcessCategory('');
    setSortOrder(0);
    setIsActive(true);
  };

  const getActorId = () => {
    const user = getStoredUser();
    return user?.user_id ?? user?.id ?? 1;
  };

  const handleSave = async () => {
    if (!processCode.trim() || !processName.trim()) {
      notify.warning('Validation Error', 'Process Code and Name are required');
      return;
    }

    try {
      const payload = {
        process_code: processCode,
        process_name: processName,
        process_category: processCategory,
        sort_order: parseInt(sortOrder) || 0,
        is_active: true,
        created_by: getActorId()
      };

      const res = await addProcess(payload).unwrap();
      if (res.status === 'success' || res.status === 1) {
        notify.success('Success', 'Process added successfully');
        handleCancel();
        refetch();
      } else {
        notify.error('Error', res.message || 'Failed to add process');
      }
    } catch (err) {
      notify.error('Error', err?.data?.message || 'Something went wrong');
    }
  };

  const handleUpdate = async () => {
    if (!processCode.trim() || !processName.trim()) {
      notify.warning('Validation Error', 'Process Code and Name are required');
      return;
    }

    try {
      const payload = {
        process_id: editingId,
        process_code: processCode,
        process_name: processName,
        process_category: processCategory,
        sort_order: parseInt(sortOrder) || 0,
        is_active: isActive,
        modified_by: getActorId()
      };

      const res = await updateProcess(payload).unwrap();
      if (res.status === 'success' || res.status === 1) {
        notify.success('Success', 'Process updated successfully');
        handleCancel();
        refetch();
      } else {
        notify.error('Error', res.message || 'Failed to update process');
      }
    } catch (err) {
      console.error(err);
      notify.error('Error', err?.data?.message || 'Something went wrong');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete Process?',
      text: 'Are you sure you want to delete this process?',
      confirmButtonText: 'Delete'
    });

    if (confirmed) {
      try {
        const res = await deleteProcess({ 
          process_id: id,
          modified_by: getActorId() 
        }).unwrap();
        
        if (res.status === 1 || res.status === 'success') {
          notify.success('Success', 'Process deleted successfully');
          refetch();
        } else {
          notify.error('Error', res.message || 'Failed to delete process');
        }

      } catch (err) {
        notify.error('Error', err?.data?.message || 'Something went wrong');
      }
    }
  };

  // Process Data
  const processes = useMemo(() => {
    if (!processData?.data) return [];
    return processData.data.map(normalizeProcessRow);
  }, [processData]);

  const filteredProcesses = useMemo(() => {
    return processes.filter(item => 
      item.processCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.processName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.processCategory.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (a.sortOrder - b.sortOrder));
  }, [processes, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredProcesses.length / itemsPerPage);
  const paginatedData = filteredProcesses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full space-y-6">
          
          {/* Layout: Form 1/4, Table 3/4 */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* Left Panel - Process Form */}
            <section className="lg:col-span-1 bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden h-fit sticky top-24">
              <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                <div className="flex items-center gap-3">
                  <FiSettings className="text-2xl" />
                  <h2 className="text-lg font-bold tracking-wide">
                    {editingId ? 'Update Process' : 'Add Process'}
                  </h2>
                </div>
              </header>

              <div className="p-6 space-y-4">
                {/* Process Code */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Process Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., IN-GTI"
                    value={processCode}
                    onChange={(e) => setProcessCode(e.target.value)}
                    className="process-input w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Process Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Process Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Gate In P-Check"
                    value={processName}
                    onChange={(e) => setProcessName(e.target.value)}
                    className="process-input w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Process Category */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Category</label>
                  <input
                    type="text"
                    placeholder="e.g., Gate / Yard / M&R"
                    value={processCategory}
                    onChange={(e) => setProcessCategory(e.target.value)}
                    className="process-input w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Sort Order */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Sort Order</label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="process-input w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Status (Only when editing) */}
                {editingId && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Status</label>
                    <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={isActive}
                          onChange={() => setIsActive(true)}
                          className="w-4 h-4 text-[#0e4a78] focus:ring-[#0e4a78]"
                        />
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                          <FiCheckCircle className="text-green-600" /> Active
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!isActive}
                          onChange={() => setIsActive(false)}
                          className="w-4 h-4 text-[#0e4a78] focus:ring-[#0e4a78]"
                        />
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                          <FiXCircle className="text-red-600" /> Inactive
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingId ? handleUpdate : handleSave}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] transition-all shadow-md"
                  >
                    {editingId ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
            </section>

            {/* Right Panel - Process Table */}
            <section className="lg:col-span-3 bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col h-full">
              <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FiSettings className="text-2xl" />
                    <h2 className="text-xl font-bold tracking-wide">Manage Processes</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-white/20 px-4 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm border border-white/10">
                      Total: {filteredProcesses.length}
                    </span>
                  </div>
                </div>
              </header>

              {/* Search Bar */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="relative max-w-md">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
                  <input
                    type="text"
                    placeholder="Search process code, name or category..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="process-input w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/20 focus:border-[#0e4a78] transition-all shadow-sm placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs md:text-sm text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                      <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Process Code</th>
                      <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Process Name</th>
                      <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Category</th>
                      <th className="px-3 sm:px-4 py-3 text-center font-semibold border-r border-white/30">Sort Order</th>
                      <th className="px-3 sm:px-4 py-3 text-center font-semibold border-r border-white/30">Status</th>
                      <th className="px-3 sm:px-4 py-3 text-center font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {isLoading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                          Loading processes...
                        </td>
                      </tr>
                    ) : paginatedData.length > 0 ? (
                      paginatedData.map((item, index) => (
                        <tr key={item.id} className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200 ${!item.isActive ? 'opacity-60 bg-slate-50' : ''}`}>
                          <td className="px-3 sm:px-4 py-3 text-slate-900 border-r border-slate-200 font-medium">{item.processCode}</td>
                          <td className="px-3 sm:px-4 py-3 text-slate-600 border-r border-slate-200">{item.processName}</td>
                          <td className="px-3 sm:px-4 py-3 text-slate-600 border-r border-slate-200">{item.processCategory}</td>
                          <td className="px-3 sm:px-4 py-3 text-center text-slate-600 border-r border-slate-200">{item.sortOrder}</td>
                          <td className="px-3 sm:px-4 py-3 text-center border-r border-slate-200">
                            {item.isActive ? (
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
                                onClick={() => handleEdit(item)}
                                className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                title="Edit"
                              >
                                <FiEdit2 className="text-sm" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
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
                            <p className="text-sm font-medium">No processes found</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredProcesses.length)} to{' '}
                    {Math.min(currentPage * itemsPerPage, filteredProcesses.length)} of {filteredProcesses.length} results
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-slate-300 disabled:opacity-50 hover:bg-slate-100 bg-white transition-colors"
                    >
                      <FiArrowLeft />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-[#0e4a78] text-white'
                            : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-slate-300 disabled:opacity-50 hover:bg-slate-100 bg-white transition-colors"
                    >
                      <FiArrowRight />
                    </button>
                  </div>
                </div>
              )}
            </section>

          </div>
        </div>
      </main>
      
      <style>{`
        .process-input {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          background-color: #ffffff !important;
          font-weight: 500 !important;
        }
        
        .process-input::placeholder {
          color: #94a3b8 !important;
          -webkit-text-fill-color: #94a3b8 !important;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};

export default ManageProcess;
