import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three'

export const ScrollController = () => {
  const cubeRef = useRef<Mesh>(null)
  const sphereRef = useRef<Mesh>(null)

  useFrame(() => {
    if (!cubeRef.current || !sphereRef.current) return
    const scrollY = window.scrollY / (document.body.scrollHeight - window.innerHeight)
    cubeRef.current.rotation.x = scrollY * Math.PI * 2
    cubeRef.current.rotation.y = scrollY * Math.PI * 2
    cubeRef.current.scale.setScalar(1 + scrollY * 0.5)
    sphereRef.current.position.y = -scrollY * 2
  })

  return (
    <>
      <mesh ref={cubeRef} position={[-2, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#dc2626" metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh ref={sphereRef} position={[2, 1, -1]}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.4} roughness={0.3} />
      </mesh>
    </>
  )
}
