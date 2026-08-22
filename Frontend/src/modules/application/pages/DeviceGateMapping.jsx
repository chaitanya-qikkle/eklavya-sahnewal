import React from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'

const DeviceGateMapping = () => (
  <div className="min-h-screen flex flex-col bg-slate-100">
    <Navbar />
    <main className="flex-1 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Device Gate Mapping</h1>
          <p className="text-slate-500 mb-6">Configure device to gate associations</p>
          <div className="border-t border-slate-200 pt-6">
            <p className="text-slate-400 text-center py-12">Device gate mapping interface coming soon...</p>
          </div>
        </div>
      </div>
    </main>
    <Footer />
  </div>
)

export default DeviceGateMapping