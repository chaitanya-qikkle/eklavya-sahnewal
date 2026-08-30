import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FaFileExcel } from "react-icons/fa";
import { FiSearch, FiTrash2, FiEdit3, FiRefreshCw, FiCheckCircle, FiXCircle, FiPlus, FiList, FiSettings, FiSmartphone, FiMonitor, FiBarChart2 } from "react-icons/fi";
import Navbar from "../../../components/layout/Navbar";
import { 
  useGetEquipmentQuery, 
  useAddEquipmentMutation, 
  useUpdateEquipmentMutation, 
  useDeleteEquipmentMutation 
} from '../../../store/api/ymsApi';
import { notify, confirmAction } from '../../../utils/notify';
import { getStoredUser } from '../../../services/authService';
import { useGetPlantsQuery } from '../../../store/api/plantApi';

const buildHeightSettings = (apiHeights) => {
  const defaultSettings = [
    { height: "1", min_value: "", max_value: "" },
    { height: "2", min_value: "", max_value: "" },
    { height: "3", min_value: "", max_value: "" },
    { height: "4", min_value: "", max_value: "" }
  ];

  if (!apiHeights || apiHeights.length === 0) return defaultSettings;

  return defaultSettings.map((slot, index) => {
    const match = apiHeights.find(
      h => parseInt(h.HEIGHT ?? h.height ?? h.Height) === index + 1
    );
    if (match) {
      return {
        height: String(index + 1),
        min_value: String(match.MIN_VALUE ?? match.min_value ?? match.Min_Value ?? ""),
        max_value: String(match.MAX_VALUE ?? match.max_value ?? match.Max_Value ?? "")
      };
    }
    return slot;
  });
};

const initialForm = {
  eqpId: null,
  equipmentName: "",
  equipmentCode: "",
  deviceId: "",
  equipmentMaker: "",
  simId: "",
  isRemoveDevice: "No",
  installationDate: "",
  ownerName: "",
  equipmentType: "",
  vtmImeiNo: "",
  jobAllow: false,
  isActive: true,
  isManualBreakdown: false,
  plantId: 1,
  heightSettings: [
    { height: "1", min_value: "", max_value: "" },
    { height: "2", min_value: "", max_value: "" },
    { height: "3", min_value: "", max_value: "" },
    { height: "4", min_value: "", max_value: "" }
  ]
};

export default function Equipment() {
  const [activeTab, setActiveTab] = useState('list');
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");

  // API Hooks
  const { data: apiData, isLoading, refetch } = useGetEquipmentQuery();
  const [addEquipment] = useAddEquipmentMutation();
  const [updateEquipment] = useUpdateEquipmentMutation();
  const [deleteEquipment] = useDeleteEquipmentMutation();
  const { data: plantsResponse, isLoading: plantsLoading } = useGetPlantsQuery();
  const plants = plantsResponse?.plants || [];

  const getActorId = () => {
    const user = getStoredUser();
    return String(user?.user_id ?? user?.id ?? '00000000-0000-0000-0000-000000000000');
  };

  // ✅ FIX 2: records useMemo mein heightSettings add kiya
  // Pehle plantId ke baad comma missing tha aur heightSettings line nahi thi
  const records = useMemo(() => {
    const rawList = Array.isArray(apiData?.data)
      ? apiData.data
      : (Array.isArray(apiData) ? apiData : []);

    if (rawList.length === 0) return [];

    return rawList.map(item => ({
      eqpId: item?.Eqp_ID ?? item?.eqp_id,
      equipmentName: item?.Equipment_Name ?? item?.equipment_name,
      equipmentCode: item?.Equipment_Code ?? item?.equipment_code,
      deviceId: item?.Device_ID ?? item?.device_id,
      equipmentMaker: item?.Equipment_Maker ?? item?.equipment_maker,
      simId: item?.Sim_ID ?? item?.sim_id,
      isRemoveDevice: (item?.IsRemoveDevice ?? item?.is_remove_device) ? "Yes" : "No",
      installationDate: item?.Installation_Date ?? item?.installation_date,
      ownerName: item?.Owner_Name ?? item?.owner_name,
      equipmentType: item?.Equipment_Type ?? item?.equipment_type,
      vtmImeiNo: item?.VTM_ImeiNo ?? item?.vtm_imei_no,
      jobAllow: item?.JobAllow ?? item?.job_allow ?? false,
      isActive: item?.IsActive ?? item?.is_active ?? true,
      isManualBreakdown: item?.IsManualBreakdown ?? item?.is_manual_breakdown ?? false,
      plantId: item?.Plant_ID ?? item?.plant_id,
      heightSettings: item?.height_settings ?? []
    }));
  }, [apiData]);

  const filteredRecords = useMemo(
    () =>
      records.filter(record => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return (
          record.equipmentName?.toLowerCase().includes(term) ||
          record.ownerName?.toLowerCase().includes(term) ||
          record.deviceId?.toLowerCase().includes(term)
        );
      }),
    [records, search]
  );

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm(prev => {
      const nextState = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      
      // Auto-fill plant ID when ownerName (Plant Name) is selected
      if (name === 'ownerName') {
        const selectedPlant = plants.find(p => p.plantName === value);
        nextState.plantId = selectedPlant ? selectedPlant.id : "";
      }
      
      return nextState;
    });
  };

  const updateHeightSetting = (index, field, value) => {
    setForm(prev => {
      const newSettings = prev.heightSettings.map((setting, i) =>
        i === index ? { ...setting, [field]: value } : setting
      );

      return { ...prev, heightSettings: newSettings };
    });
  };

  const handleAddNew = () => {
    setForm(initialForm);
    setActiveTab('form');
  };

  // ✅ FIX 3: handleEdit mein hardcoded empty array hata ke buildHeightSettings use kiya
  const handleEdit = (record) => {
    setForm({
      eqpId: record.eqpId,
      equipmentName: record.equipmentName || "",
      equipmentCode: record.equipmentCode || "",
      deviceId: record.deviceId || "",
      equipmentMaker: record.equipmentMaker || "",
      simId: record.simId || "",
      isRemoveDevice: record.isRemoveDevice || "No",
      installationDate: record.installationDate ? record.installationDate.substring(0, 16) : "",
      ownerName: record.ownerName || "",
      equipmentType: record.equipmentType || "",
      vtmImeiNo: record.vtmImeiNo || "",
      jobAllow: !!record.jobAllow,
      isActive: !!record.isActive,
      isManualBreakdown: !!record.isManualBreakdown,
      plantId: record.plantId || 1,
      heightSettings: buildHeightSettings(record.heightSettings) // ✅ API data se height fill hoga
    });
    setActiveTab('form');
  };

  const handleCancel = () => {
    setForm(initialForm);
    setActiveTab('list');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.equipmentName.trim()) {
      notify.warning("Validation", "Equipment Name is required");
      return;
    }

    // Validate height settings (manual ranges)
    for (let i = 0; i < form.heightSettings.length; i++) {
      const setting = form.heightSettings[i];

      const hasAnyValue = Boolean(setting.min_value) || Boolean(setting.max_value);
      if (!hasAnyValue) continue;

      if (!setting.min_value) {
        notify.warning("Validation", `Height ${i + 1}: Min value is required`);
        return;
      }

      if (!setting.max_value) {
        notify.warning("Validation", `Height ${i + 1}: Max value is required`);
        return;
      }

      if (parseFloat(setting.min_value) >= parseFloat(setting.max_value)) {
        notify.warning("Validation", `Height ${i + 1}: Min value must be less than max value`);
        return;
      }
    }

    try {
      const payload = {
        plant_id: parseInt(form.plantId) || 1,
        equipment_code: form.equipmentCode,
        equipment_name: form.equipmentName,
        device_id: form.deviceId,
        installation_date: form.installationDate || null,
        owner_name: form.ownerName,
        equipment_type: form.equipmentType,
        equipment_maker: form.equipmentMaker,
        sim_id: form.simId,
        vtm_imei_no: form.vtmImeiNo,
        job_allow: form.jobAllow,
        is_active: form.isActive,
        is_remove_device: form.isRemoveDevice === "Yes",
        is_manual_breakdown: form.isManualBreakdown,
        height_settings: form.heightSettings
          .filter(setting => setting.max_value)
          .map((setting, index) => ({
            height: parseFloat(index + 1),
            min_value: parseFloat(setting.min_value),
            max_value: parseFloat(setting.max_value)
          }))
      };

      let res;
      if (form.eqpId) {
        res = await updateEquipment({
          ...payload,
          eqp_id: form.eqpId,
          modified_by: getActorId()
        }).unwrap();
      } else {
        res = await addEquipment({
          ...payload,
          created_by: getActorId()
        }).unwrap();
      }

      if (res.status === 'success' || res.status === 1) {
        notify.success("Success", form.eqpId ? "Equipment updated successfully" : "Equipment added successfully");
        setForm(initialForm);
        setActiveTab('list');
        refetch();
      } else {
        notify.error("Error", res.message || "Operation failed");
      }
    } catch (err) {
      console.error(err);
      notify.error("Error", err?.data?.message || err.message || "Something went wrong");
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete Equipment?',
      text: 'Are you sure you want to delete this equipment?',
      confirmButtonText: 'Delete'
    });

    if (confirmed) {
      try {
        const res = await deleteEquipment({
          eqp_id: id,
          modified_by: getActorId()
        }).unwrap();

        if (res.status === 'success' || res.status === 1) {
          notify.success("Success", "Equipment deleted successfully");
          refetch();
        } else {
          notify.error("Error", res.message || "Failed to delete equipment");
        }
      } catch (err) {
        notify.error("Error", err?.data?.message || "Something went wrong");
      }
    }
  };

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Equipment");
    XLSX.writeFile(workbook, "equipment-master.xlsx");
  };

  return (
    <div className="min-h-screen bg-[#0c111f]">
      <div
        className="min-h-screen bg-cover bg-center"
        style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
      >
        <div className="min-h-screen bg-white/80 backdrop-blur-sm">
          <Navbar />

          <main className="max-w-[1920px] mx-auto px-6 py-8">

            {/* Main Card Container */}
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col min-h-[700px]">

              {/* Gradient Header with Tabs */}
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                <div className="px-6 py-4 border-b border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-wide">Equipment Master</h1>
                    <p className="text-sm text-white/80 mt-1">Manage equipment inventory and telemetry configuration</p>
                  </div>

                  {/* Tab Switcher */}
                  <div className="flex bg-black/20 rounded-lg p-1">
                    <button
                      onClick={() => setActiveTab('list')}
                      className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'list' ? 'bg-white text-[#0e4a78] shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                    >
                      <FiList /> List View
                    </button>
                    <button
                      onClick={() => {
                        if (activeTab === 'list') handleAddNew();
                        else setActiveTab('form');
                      }}
                      className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'form' ? 'bg-white text-[#0e4a78] shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                    >
                      {form.eqpId ? <FiEdit3 /> : <FiPlus />} {form.eqpId ? 'Edit / Update' : 'New Entry'}
                    </button>
                  </div>
                </div>

                {/* Sub-Header / Toolbar (List Mode Only) */}
                {activeTab === 'list' && (
                  <div className="bg-[#083153]/50 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full sm:max-w-md">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search equipment by name, device id..."
                        autoComplete="off"
                        className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={refetch} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors" title="Refresh Data">
                        <FiRefreshCw className={`${isLoading ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors shadow-sm"
                      >
                        <FaFileExcel /> Export Excel
                      </button>
                    </div>
                  </div>
                )}
              </header>

              {/* VIEW: LIST (Table) */}
              {activeTab === 'list' && (
                <div className="flex-1 overflow-auto bg-slate-50">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white shadow-md">
                      <tr>
                        <th className="px-4 py-3.5 font-semibold text-left border-r border-white/20">Equipment Name</th>
                        <th className="px-4 py-3.5 font-semibold text-left border-r border-white/20">Device ID</th>
                        <th className="px-4 py-3.5 font-semibold text-left border-r border-white/20">Maker</th>
                        <th className="px-4 py-3.5 font-semibold text-left border-r border-white/20">Sim Info</th>
                        <th className="px-4 py-3.5 font-semibold text-center border-r border-white/20">Type</th>
                        <th className="px-4 py-3.5 font-semibold text-center border-r border-white/20">Active</th>
                        <th className="px-4 py-3.5 font-semibold text-center border-r border-white/20">Job Allow</th>
                        <th className="px-4 py-3.5 font-semibold text-center border-r border-white/20">Device Status</th>
                        <th className="px-4 py-3.5 font-semibold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {isLoading ? (
                        <tr><td colSpan="9" className="text-center py-20 text-slate-500">Loading records...</td></tr>
                      ) : filteredRecords.length > 0 ? (
                        filteredRecords.map((record, index) => (
                          <tr
                            key={record.eqpId || index}
                            className={`hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                          >
                            <td className="px-4 py-3 font-semibold text-slate-900 border-r border-slate-100">{record.equipmentName}</td>
                            <td className="px-4 py-3 text-slate-600 font-mono text-xs border-r border-slate-100">{record.deviceId}</td>
                            <td className="px-4 py-3 text-slate-700 border-r border-slate-100">{record.equipmentMaker}</td>
                            <td className="px-4 py-3 border-r border-slate-100">
                              <div className="flex flex-col">
                                <span className="text-xs font-mono text-slate-600">S: {record.simId}</span>
                                <span className="text-[10px] text-slate-400">V: {record.vtmImeiNo}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center border-r border-slate-100">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">
                                {record.equipmentType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center border-r border-slate-100">
                              {record.isActive ? (
                                <FiCheckCircle className="inline text-green-600 text-lg" />
                              ) : (
                                <FiXCircle className="inline text-slate-300 text-lg" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-center border-r border-slate-100">
                              {record.jobAllow ? (
                                <span className="text-green-600 font-bold text-lg">✓</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center border-r border-slate-100">
                              {record.isRemoveDevice === "Yes" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-600 text-xs font-medium border border-red-100">
                                  <FiXCircle /> Removed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-600 text-xs font-medium border border-green-100">
                                  <FiCheckCircle /> Linked
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEdit(record)}
                                  className="p-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors border border-blue-200"
                                  title="Edit"
                                >
                                  <FiEdit3 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(record.eqpId)}
                                  className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-800 transition-colors border border-red-200"
                                  title="Delete"
                                >
                                  <FiTrash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="9" className="text-center py-20 text-slate-400">No equipment records found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* VIEW: FORM */}
              {activeTab === 'form' && (
                <div className="flex-1 overflow-auto bg-slate-50 p-6 flex justify-center items-start">
                  <div className="w-full max-w-5xl">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6">

                      {/* CARD 1: Basic Info */}
                      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center gap-2">
                          <FiMonitor className="text-[#0e4a78]" />
                          <h3 className="font-bold text-slate-700">Equipment Information</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <TextField label="Equipment Name" name="equipmentName" value={form.equipmentName} onChange={handleChange} required />
                          <TextField label="Equipment Code" name="equipmentCode" value={form.equipmentCode} onChange={handleChange} />
                          <SelectField label="Owner Name (Plant Name)" name="ownerName" value={form.ownerName} onChange={handleChange} options={plants.map(p => p.plantName)} />
                          <TextField label="Equipment Type" name="equipmentType" value={form.equipmentType} onChange={handleChange} />
                          <TextField label="Equipment Maker" name="equipmentMaker" value={form.equipmentMaker} onChange={handleChange} />
                          <TextField label="Plant ID" name="plantId" value={form.plantId} onChange={handleChange} type="number" readOnly />
                          <TextField label="Installation Date" name="installationDate" value={form.installationDate} onChange={handleChange} type="datetime-local" />
                        </div>
                      </div>

                      {/* CARD 2: Height Settings */}
                      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FiBarChart2 className="text-purple-600" />
                            <h3 className="font-bold text-slate-700">Height Settings</h3>
                          </div>
                        </div>
                        <div className="p-6">
                          <div className="space-y-4">
                            {/* Header Row */}
                            <div className="grid grid-cols-12 gap-4 pb-2 border-b border-slate-200">
                              <div className="col-span-1 text-xs font-bold text-slate-500 uppercase"></div>
                              <div className="col-span-3 text-xs font-bold text-slate-600 uppercase">Height</div>
                              <div className="col-span-4 text-xs font-bold text-slate-600 uppercase">Min Value</div>
                              <div className="col-span-4 text-xs font-bold text-slate-600 uppercase">Max Value</div>
                            </div>

                            {/* Data Rows */}
                            {form.heightSettings.map((setting, index) => (
                              <div key={index} className="grid grid-cols-12 gap-4 items-center bg-slate-50 p-3 rounded-lg border border-slate-200 hover:border-purple-300 transition-colors">
                                <div className="col-span-1 flex items-center justify-center">
                                  <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-sm flex items-center justify-center">
                                    H{index + 1}
                                  </span>
                                </div>
                                <div className="col-span-3">
                                  <input
                                    type="text"
                                    value={setting.height}
                                    disabled
                                    autoComplete="off"
                                    className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 font-medium cursor-not-allowed"
                                  />
                                </div>
                                <div className="col-span-4">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={setting.min_value}
                                    onChange={(e) => updateHeightSetting(index, 'min_value', e.target.value)}
                                    placeholder={index === 0 ? "Enter starting min value" : "Enter min value"}
                                    autoComplete="off"
                                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                                  />
                                </div>
                                <div className="col-span-4">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={setting.max_value}
                                    onChange={(e) => updateHeightSetting(index, 'max_value', e.target.value)}
                                    placeholder="Enter max value"
                                    autoComplete="off"
                                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                                  />
                                </div>
                              </div>
                            ))}

                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-xs text-blue-700 flex items-center gap-2">
                                <FiBarChart2 className="text-blue-600" />
                                <span><strong>Note:</strong> Enter the min/max range manually for each height.</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CARD 3: Device Config */}
                      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center gap-2">
                          <FiSmartphone className="text-emerald-600" />
                          <h3 className="font-bold text-slate-700">Device Configuration</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                          <TextField label="Device ID" name="deviceId" value={form.deviceId} onChange={handleChange} />
                          <TextField label="Sim ID" name="simId" value={form.simId} onChange={handleChange} />
                          <TextField label="VTM IMEI No" name="vtmImeiNo" value={form.vtmImeiNo} onChange={handleChange} />
                          <SelectField label="Is Remove Device" name="isRemoveDevice" value={form.isRemoveDevice} onChange={handleChange} options={["No", "Yes"]} />
                        </div>
                      </div>

                      {/* CARD 4: Settings & Actions */}
                      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center gap-2">
                          <FiSettings className="text-slate-600" />
                          <h3 className="font-bold text-slate-700">Operational Settings</h3>
                        </div>
                        <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className="flex flex-wrap gap-6">
                            <CheckboxField label="Job Allowed" name="jobAllow" checked={form.jobAllow} onChange={handleChange} />
                            <CheckboxField label="Is Active" name="isActive" checked={form.isActive} onChange={handleChange} />
                            <CheckboxField label="Manual Breakdown" name="isManualBreakdown" checked={form.isManualBreakdown} onChange={handleChange} />
                          </div>
                          <div className="flex gap-3 w-full md:w-auto">
                            <button type="button" onClick={handleCancel} className="flex-1 md:flex-none px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors">
                              Cancel
                            </button>
                            <button type="submit" className="flex-1 md:flex-none px-8 py-2.5 rounded-lg bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-bold shadow-lg hover:shadow-xl hover:from-[#0a3b61] hover:to-[#083153] transition-all">
                              {form.eqpId ? "Update Equipment" : "Save Equipment"}
                            </button>
                          </div>
                        </div>
                      </div>

                    </form>
                  </div>
                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

const TextField = ({ label, name, value, onChange, type = "text", required, disabled, readOnly }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      autoComplete="off"
      className={`w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/20 focus:border-[#0e4a78] transition-all ${disabled || readOnly ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white text-slate-800'}`}
      placeholder={`Enter ${label.toLowerCase()}`}
    />
  </div>
);

const SelectField = ({ label, name, value, onChange, options }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">{label}</label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/20 focus:border-[#0e4a78] transition-all appearance-none"
    >
      <option value="">Select option</option>
      {options.map(option => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </div>
);

const CheckboxField = ({ label, name, checked, onChange }) => (
  <label className="flex items-center gap-3 cursor-pointer group select-none">
    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm ${checked ? 'bg-[#0e4a78] border-[#0e4a78]' : 'bg-white border-slate-300 group-hover:border-[#0e4a78]'}`}>
      {checked && <FiCheckCircle className="text-white text-xs" />}
    </div>
    <input
      type="checkbox"
      name={name}
      checked={checked}
      onChange={onChange}
      className="hidden"
    />
    <span className={`text-sm font-semibold transition-colors ${checked ? 'text-[#0e4a78]' : 'text-slate-600'}`}>{label}</span>
  </label>
);