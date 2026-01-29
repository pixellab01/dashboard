'use client'

import { useRef, useMemo, useEffect, useState } from 'react'
import { Mesh } from 'three'
import * as THREE from 'three'

// Dynamic import wrapper to prevent ReactCurrentOwner errors
// This ensures React Three Fiber only loads after React is fully initialized
let CanvasComponent: any = null
let useFrameHook: any = null

async function loadReactThreeFiber() {
  if (!CanvasComponent && typeof window !== 'undefined') {
    try {
      const r3f = await import('@react-three/fiber')
      CanvasComponent = r3f.Canvas
      useFrameHook = r3f.useFrame
      return true
    } catch (error) {
      console.error('Failed to load React Three Fiber:', error)
      return false
    }
  }
  return CanvasComponent !== null
}

// Wrapper components that use useFrame hook properly
function FloatingCube({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<Mesh>(null!)
  
  // useFrame must be called unconditionally - create a wrapper component
  function AnimatedCube() {
    if (useFrameHook) {
      useFrameHook((state: any) => {
        if (meshRef.current) {
          meshRef.current.rotation.x += 0.01
          meshRef.current.rotation.y += 0.01
          meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + position[0]) * 0.3
        }
      })
    }
    return null
  }

  return (
    <>
      <AnimatedCube />
      <mesh ref={meshRef} position={position}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial 
          color={new THREE.Color().setHSL(0, 0, Math.random() * 0.3 + 0.4)} 
          emissive={new THREE.Color().setHSL(0, 0, 0.1)}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
    </>
  )
}

function RotatingSphere({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<Mesh>(null!)
  
  function AnimatedSphere() {
    if (useFrameHook) {
      useFrameHook((state: any) => {
        if (meshRef.current) {
          meshRef.current.rotation.x += 0.005
          meshRef.current.rotation.y += 0.01
          meshRef.current.position.y = position[1] + Math.cos(state.clock.elapsedTime + position[0]) * 0.4
        }
      })
    }
    return null
  }

  return (
    <>
      <AnimatedSphere />
      <mesh ref={meshRef} position={position}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial 
          color={new THREE.Color().setHSL(0, 0, Math.random() * 0.3 + 0.4)} 
          emissive={new THREE.Color().setHSL(0, 0, 0.1)}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
    </>
  )
}

function TorusRing({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<Mesh>(null!)
  
  function AnimatedTorus() {
    if (useFrameHook) {
      useFrameHook((state: any) => {
        if (meshRef.current) {
          meshRef.current.rotation.x += 0.008
          meshRef.current.rotation.z += 0.005
          meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + position[0]) * 0.2
        }
      })
    }
    return null
  }

  return (
    <>
      <AnimatedTorus />
      <mesh ref={meshRef} position={position}>
        <torusGeometry args={[1, 0.3, 16, 100]} />
        <meshStandardMaterial 
          color={new THREE.Color().setHSL(0, 0, Math.random() * 0.3 + 0.4)} 
          emissive={new THREE.Color().setHSL(0, 0, 0.1)}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
    </>
  )
}

function Particles() {
  const particles = useMemo(() => {
    const count = 1000
    const positions = new Float32Array(count * 3)
    
    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 20
    }
    
    return positions
  }, [])

  const particlesRef = useRef<THREE.Points>(null!)

  function AnimatedParticles() {
    if (useFrameHook) {
      useFrameHook(() => {
        if (particlesRef.current) {
          particlesRef.current.rotation.y += 0.0005
        }
      })
    }
    return null
  }

  return (
    <>
      <AnimatedParticles />
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particles.length / 3}
            array={particles}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.05} color="#ffffff" transparent opacity={0.6} />
      </points>
    </>
  )
}

export default function Scene3D() {
  const [isReady, setIsReady] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Load React Three Fiber after React is initialized
    loadReactThreeFiber()
      .then((loaded) => {
        if (loaded) {
          // Small delay to ensure everything is ready
          setTimeout(() => {
            setIsReady(true)
          }, 100)
        } else {
          setHasError(true)
        }
      })
      .catch((error) => {
        console.error('Failed to initialize Scene3D:', error)
        setHasError(true)
      })
  }, [])

  // Don't render on server or if not ready
  if (typeof window === 'undefined' || !isReady || !CanvasComponent || hasError) {
    return null
  }

  try {
    return (
      <div className="absolute inset-0 w-full h-full">
        <CanvasComponent
          camera={{ position: [0, 0, 8], fov: 75 }}
          gl={{ 
            antialias: true, 
            alpha: true,
            powerPreference: "high-performance"
          }}
          dpr={[1, 2]}
          frameloop="always"
        >
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="#6b7280" />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          
          <FloatingCube position={[-3, 2, -2]} />
          <FloatingCube position={[3, -2, -3]} />
          <FloatingCube position={[-2, -3, -1]} />
          <FloatingCube position={[2, 3, -4]} />
          
          <RotatingSphere position={[-4, 0, -2]} />
          <RotatingSphere position={[4, 1, -3]} />
          
          <TorusRing position={[0, -2, -1]} />
          <TorusRing position={[-1, 2, -2]} />
          
          <Particles />
        </CanvasComponent>
      </div>
    )
  } catch (error) {
    console.error('Scene3D render error:', error)
    return null
  }
}
