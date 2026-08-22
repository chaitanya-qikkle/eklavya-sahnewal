import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Sky } from '@react-three/drei';
import { useYardStore } from '../../../store/yardStore';
import Container3D from './Container3D';
import Ground3D from './Ground3D';

const YardCanvas3D = () => {
  const {
    selectedTiers,
    viewMode,
    getFilteredContainers,
    selectContainer,
    hoverContainer,
  } = useYardStore();

  const containers = getFilteredContainers();

  const handleContainerClick = (container) => {
    selectContainer(container);
  };

  const handleContainerHover = (container, isHovering) => {
    hoverContainer(isHovering ? container : null);
  };

  return (
    <Canvas
      camera={{ position: [50, 50, 50], fov: 50 }}
      shadows
      className="w-full h-full"
    >
      <Suspense fallback={null}>
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[50, 50, 25]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-50, 50, -50]} intensity={0.5} />

        {/* Sky */}
        <Sky sunPosition={[100, 20, 100]} />

        {/* Ground */}
        <Ground3D />

        {/* Grid */}
        <Grid
          args={[300, 300]}
          cellSize={5}
          cellThickness={0.5}
          cellColor="#334155"
          sectionSize={25}
          sectionThickness={1}
          sectionColor="#475569"
          fadeDistance={400}
          fadeStrength={1}
          followCamera={false}
        />

        {/* Containers */}
        {containers.map((container) => {
          const isVisible = selectedTiers.includes(container.tier);
          return (
            <Container3D
              key={container.containerId}
              container={container}
              isVisible={isVisible}
              onClick={() => handleContainerClick(container)}
              onHover={(isHovering) => handleContainerHover(container, isHovering)}
            />
          );
        })}

        {/* Camera Controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={20}
          maxDistance={200}
          maxPolarAngle={Math.PI / 2.2}
        />
      </Suspense>
    </Canvas>
  );
};

export default YardCanvas3D;
