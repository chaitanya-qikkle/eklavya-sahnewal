import React from 'react';

const Ground3D = () => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
      <planeGeometry args={[500, 500]} />
      <meshStandardMaterial
        color="#1E293B"
        metalness={0.1}
        roughness={0.9}
      />
    </mesh>
  );
};

export default Ground3D;
