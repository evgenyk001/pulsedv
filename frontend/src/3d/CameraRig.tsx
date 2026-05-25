import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Group } from 'three'

export const CameraRig = () => {
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    if (!groupRef.current) return
    const scrollY = window.scrollY / (document.body.scrollHeight - window.innerHeight)
    const z = 8 - scrollY * 4
    const x = scrollY * 0.5
    const y = -scrollY * 0.3
    groupRef.current.position.set(x, y, z)
    groupRef.current.rotation.x = scrollY * 0.2
    groupRef.current.rotation.y = scrollY * 0.5
  })

  return <group ref={groupRef} />
}
