import { Canvas } from '@react-three/fiber'
import { Environment, Float } from '@react-three/drei'
import { CameraRig } from './CameraRig'
import { ScrollController } from './ScrollController'
import { BuildingModel } from './Models/BuildingModel'

export const Scene3D = () => {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 45 }}
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-5, 2, 3]} intensity={0.5} />
      <Environment preset="city" />
      
      <CameraRig />
      <ScrollController />
      
      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
        <BuildingModel />
      </Float>
    </Canvas>
  )
}
