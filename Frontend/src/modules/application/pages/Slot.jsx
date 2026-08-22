const summaryCards = [
  { label: 'Total Slots', value: '0' },
  { label: 'Available', value: '0' },
  { label: 'Occupied', value: '0' }
]

const Slot = () => (
  <div className="min-h-screen bg-slate-100 p-6">
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Slot Setup</p>
          <h1 className="text-2xl font-bold text-slate-800">Slot Management</h1>
          <p className="text-slate-500">Manage yard slots, availability, and occupancy. Client details are handled on the Client page.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Slot Records</h2>
              <p className="text-sm text-slate-500">Use this page to define and monitor slot positions.</p>
            </div>
            <div className="divide-y divide-slate-200">
              <div className="px-5 py-10 text-center">
                <p className="font-semibold text-slate-800">No slot records yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  Add slot records here when you are ready to configure yard positions.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Slot-focused workflow</h2>
            <p className="text-slate-500 mb-4">
              This screen is structured around slot master data, occupancy, and slot availability.
            </p>
            <div className="space-y-3">
              <div className="rounded-xl bg-white border border-slate-200 p-4">
                <p className="font-medium text-slate-800">Create slot</p>
                <p className="text-sm text-slate-500">Add a new slot master record.</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-4">
                <p className="font-medium text-slate-800">Track availability</p>
                <p className="text-sm text-slate-500">Monitor which slots are open, occupied, or blocked.</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-4">
                <p className="font-medium text-slate-800">Manage occupancy</p>
                <p className="text-sm text-slate-500">Update slot occupancy as yard operations change.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)

export default Slot