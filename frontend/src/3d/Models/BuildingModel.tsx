import { useRef } from 'react'
import { Group } from 'three'
import { useFrame } from '@react-three/fiber'

export const BuildingModel = () => {
  const groupRef = useRef<Group>(null)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.1
  })

  return (
    <group ref={groupRef}>
      <mesh position={[0, -1.5, 0]} receiveShadow>
        <boxGeometry args={[3, 0.5, 3]} />
        <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.2, 2, 1.2]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.8, 0]} castShadow>
        <coneGeometry args={[0.8, 0.8, 8]} />
        <meshStandardMaterial color="#dc2626" metalness={0.9} />
      </mesh>
      {[...Array(4)].map((_, i) => (
        <mesh key={i} position={[-0.4, 0.2 + i * 0.5, 0.61]} castShadow>
          <boxGeometry args={[0.3, 0.4, 0.05]} />
          <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  )
}
