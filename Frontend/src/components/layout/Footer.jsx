import React from 'react';

const Footer = () => (
  <footer className="w-full bg-[#012541] text-white py-1 mt-auto">
    <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
      <p className="text-white/80 text-xs font-medium">
        Gateway Distriparks Limited - ICD Sahnewal
      </p>
      <p className="text-white/80 text-xs">
        © {new Date().getFullYear()} Qikkle Solutions Pvt Ltd. All rights reserved.
      </p>
    </div>
  </footer>
);

export default Footer;