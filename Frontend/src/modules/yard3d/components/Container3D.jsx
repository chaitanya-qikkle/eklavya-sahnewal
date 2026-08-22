import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { colors } from '../../../styles/designTokens';
import * as THREE from 'three';

const Container3D = ({ container, isVisible, onClick, onHover }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  // Get color based on status
  const getStatusColor = (status) => {
    const statusColors = {
      full: colors.status.full,
      empty: colors.status.empty,
      damaged: colors.status.damaged,
      hold: colors.status.hold,
      export: colors.status.export,
      import: colors.status.import,
      reefer: colors.status.reefer,
      hazmat: colors.status.hazmat,
    };
    return statusColors[status] || colors.status.empty;
  };

  // Get container dimensions based on size
  const getDimensions = (size) => {
    const dimensions = {
      '20ft': { width: 2.4, height: 2.6, depth: 6 },
      '40ft': { width: 2.4, height: 2.6, depth: 12 },
      '45ft': { width: 2.4, height: 2.6, depth: 13.7 },
    };
    return dimensions[size] || dimensions['40ft'];
  };

  const dims = getDimensions(container.size);
  const color = getStatusColor(container.status);

  // Animation for hover effect
  useFrame(() => {
    if (meshRef.current) {
      const targetY = hovered ? container.position.y + 0.5 : container.position.y;
      meshRef.current.position.y += (targetY - meshRef.current.position.y) * 0.1;
    }
  });

  const handlePointerOver = (e) => {
    e.stopPropagation();
    setHovered(true);
    onHover(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    onHover(false);
    document.body.style.cursor = 'default';
  };

  const handleClick = (e) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <mesh
      ref={meshRef}
      position={[container.position.x, container.position.y, container.position.z]}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      castShadow
      receiveShadow
      visible={isVisible}
    >
      <boxGeometry args={[dims.width, dims.height, dims.depth]} />
      <meshStandardMaterial
        color={color}
        metalness={0.3}
        roughness={0.7}
        emissive={hovered ? color : '#000000'}
        emissiveIntensity={hovered ? 0.3 : 0}
        opacity={isVisible ? 1 : 0.3}
        transparent
      />
      
      {/* Outline when hovered */}
      {hovered && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(dims.width, dims.height, dims.depth)]} />
          <lineBasicMaterial color="#60A5FA" linewidth={2} />
        </lineSegments>
      )}
    </mesh>
  );
};

export default Container3D;
