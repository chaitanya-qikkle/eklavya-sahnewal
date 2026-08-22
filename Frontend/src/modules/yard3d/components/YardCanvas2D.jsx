import React, { useRef, useEffect, useState } from 'react';
import { useYardStore } from '../../../store/yardStore';

const YardCanvas2D = () => {
  const canvasRef = useRef(null);
  const [hoveredContainer, setHoveredContainer] = useState(null);
  const {
    selectedTiers,
    getFilteredContainers,
    selectContainer,
  } = useYardStore();

  const containers = getFilteredContainers();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas size
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw grid
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < rect.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, rect.height);
      ctx.stroke();
    }
    for (let i = 0; i < rect.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(rect.width, i);
      ctx.stroke();
    }

    // Draw containers
    const scale = 3;
    const offsetX = rect.width / 2 - 100;
    const offsetY = rect.height / 2 - 100;

    containers.forEach((container) => {
      if (!selectedTiers.includes(container.tier)) return;

      const x = offsetX + container.position.x * scale;
      const y = offsetY + container.position.z * scale;
      const width = container.size === '40ft' ? 40 : 20;
      const height = 20;

      // Shadow for depth
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(x + 2, y + 2 + (container.tier - 1) * 5, width, height);

      // Container color based on status
      const colors = {
        full: '#10B981',
        empty: '#6B7280',
        damaged: '#EF4444',
        hold: '#F59E0B',
      };
      ctx.fillStyle = colors[container.status] || '#6B7280';
      
      // Highlight if hovered
      if (hoveredContainer?.containerId === container.containerId) {
        ctx.shadowColor = '#60A5FA';
        ctx.shadowBlur = 15;
      }

      ctx.fillRect(x, y + (container.tier - 1) * 5, width, height);
      ctx.shadowBlur = 0;

      // Border
      ctx.strokeStyle = hoveredContainer?.containerId === container.containerId ? '#60A5FA' : '#1E293B';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y + (container.tier - 1) * 5, width, height);

      // Container number
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '8px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(
        container.containerNo.slice(-4),
        x + width / 2,
        y + height / 2 + (container.tier - 1) * 5 + 3
      );
    });
  }, [containers, selectedTiers, hoveredContainer]);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scale = 3;
    const offsetX = rect.width / 2 - 100;
    const offsetY = rect.height / 2 - 100;

    let found = null;
    containers.forEach((container) => {
      if (!selectedTiers.includes(container.tier)) return;

      const cx = offsetX + container.position.x * scale;
      const cy = offsetY + container.position.z * scale + (container.tier - 1) * 5;
      const width = container.size === '40ft' ? 40 : 20;
      const height = 20;

      if (x >= cx && x <= cx + width && y >= cy && y <= cy + height) {
        found = container;
      }
    });

    setHoveredContainer(found);
  };

  const handleClick = () => {
    if (hoveredContainer) {
      selectContainer(hoveredContainer);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-pointer"
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      style={{ background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)' }}
    />
  );
};

export default YardCanvas2D;
