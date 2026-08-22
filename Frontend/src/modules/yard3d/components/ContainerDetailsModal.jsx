import React, { useEffect } from 'react';
import { X, MapPin, Package, Calendar, FileText, AlertCircle } from 'lucide-react';
import { useYardStore } from '../../../store/yardStore';
import { format } from 'date-fns';

const ContainerDetailsModal = () => {
  const { selectedContainer, closeDetailsModal } = useYardStore();

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeDetailsModal();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [closeDetailsModal]);

  if (!selectedContainer) return null;

  const container = selectedContainer;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
        onClick={closeDetailsModal}
      />

      {/* Modal */}
      <div className="fixed right-0 top-0 w-full max-w-2xl h-screen glass border-l border-slate-700 z-[101] overflow-y-auto custom-scrollbar slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800/95 backdrop-blur-sm p-6 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-100">
            Container Details
          </h2>
          <button
            onClick={closeDetailsModal}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Container Header */}
          <div className="flex gap-6 p-6 glass-light rounded-xl">
            <div className="w-32 h-32 bg-slate-700/50 rounded-lg flex items-center justify-center text-5xl">
              📦
            </div>
            <div className="flex-1">
              <div className="font-mono text-2xl font-bold text-slate-100 mb-2">
                {container.containerNo}
              </div>
              <div className="text-slate-400 mb-3">
                {container.size} {container.type}
              </div>
              <div className={`status-badge ${container.status} inline-flex`}>
                {container.status}
              </div>
            </div>
          </div>

          {/* Location */}
          <InfoSection icon={<MapPin size={20} />} title="Location">
            <div className="grid grid-cols-2 gap-4">
              <InfoItem label="Block" value={container.block} />
              <InfoItem label="Row" value={container.row} />
              <InfoItem label="Slot" value={container.slot} />
              <InfoItem label="Tier" value={container.tier} />
            </div>
            <button className="mt-4 btn-secondary text-sm w-full">
              View in 3D
            </button>
          </InfoSection>

          {/* Cargo Information */}
          <InfoSection icon={<Package size={20} />} title="Cargo Information">
            <InfoItem label="Commodity" value={container.commodity} />
            <InfoItem label="Weight" value={`${container.weight?.toLocaleString()} kg`} />
            <InfoItem label="Customer" value={container.customer} />
            <InfoItem label="Shipping Line" value="Maersk" />
          </InfoSection>

          {/* Timeline */}
          <InfoSection icon={<Calendar size={20} />} title="Timeline">
            <InfoItem
              label="Arrival Date"
              value={container.arrivalDate ? format(new Date(container.arrivalDate), 'MMM dd, yyyy HH:mm') : 'N/A'}
            />
            <InfoItem label="Expected Departure" value="Feb 20, 2024" />
            <InfoItem label="Dwell Time" value="5 days" />
          </InfoSection>

          {/* Documents */}
          <InfoSection icon={<FileText size={20} />} title="Documents">
            <InfoItem label="BL Number" value={container.blNumber || 'BL123456'} />
            <InfoItem label="DO Number" value="DO789012" />
            <InfoItem label="Invoice" value="INV-2024-001" />
            <button className="mt-4 btn-secondary text-sm w-full">
              📥 Download All Documents
            </button>
          </InfoSection>

          {/* Special Requirements */}
          <InfoSection icon={<AlertCircle size={20} />} title="Special Requirements">
            <div className="space-y-2">
              <RequirementItem label="Hazardous Material" value={false} />
              <RequirementItem label="Refrigerated" value={container.type === 'RF'} />
              <RequirementItem label="Power Required" value={false} />
              <RequirementItem label="Oversize" value={false} />
            </div>
          </InfoSection>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-slate-800/95 backdrop-blur-sm p-6 border-t border-slate-700 flex gap-3">
          <button className="flex-1 btn-secondary">
            Update Status
          </button>
          <button className="flex-1 btn-secondary">
            Move Container
          </button>
          <button className="flex-1 btn-primary">
            Generate Report
          </button>
        </div>
      </div>
    </>
  );
};

const InfoSection = ({ icon, title, children }) => (
  <div className="glass-light rounded-xl p-6">
    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-700">
      <div className="text-blue-400">{icon}</div>
      <h3 className="font-semibold text-slate-100 uppercase tracking-wide text-sm">
        {title}
      </h3>
    </div>
    <div className="space-y-3">
      {children}
    </div>
  </div>
);

const InfoItem = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
    <span className="text-slate-400 text-sm">{label}</span>
    <span className="text-slate-100 font-medium text-sm">{value}</span>
  </div>
);

const RequirementItem = ({ label, value }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-slate-300 text-sm">{label}</span>
    <span className={`text-sm font-medium ${value ? 'text-green-400' : 'text-slate-500'}`}>
      {value ? 'Yes' : 'No'}
    </span>
  </div>
);

export default ContainerDetailsModal;
