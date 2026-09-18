import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Next-Gen 3D Live Ocean Background for ORCA.
 * Features:
 * - Multi-octave Gerstner-inspired ocean swell simulation
 * - Dynamic bioluminescent vertex depth shading (abyssal blue -> vivid cyan -> electric foam crests)
 * - Wet reflective water surface with specular moon/beacon highlights
 * - Drifting bioluminescent marine motes (phytoplankton)
 * - Smooth interactive cursor camera parallax
 */
export default function OceanCanvas({
  className = "",
  theme = "dark",
}: {
  className?: string;
  theme?: "light" | "dark";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isLight = theme === "light";

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setClearColor(isLight ? 0xEDF4FA : 0x020712, 1);

    // --- Scene & Camera ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(isLight ? 0xEDF4FA : 0x020712, isLight ? 0.038 : 0.045);

    const camera = new THREE.PerspectiveCamera(
      52,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      120
    );
    camera.position.set(0, 3.8, 8.5);
    camera.lookAt(0, 0.4, 0);

    // Camera target for smooth cursor parallax
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const onPointerMove = (e: MouseEvent) => {
      mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointerMove);

    // --- Ocean Geometry ---
    const GRID_SIZE = 28;
    const SEGS = 110;
    const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, SEGS, SEGS);
    geo.rotateX(-Math.PI / 2);

    // Add per-vertex colors for depth/crest glow
    const posArr = geo.attributes.position;
    const count = posArr.count;
    const colors = new Float32Array(count * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Color palettes for depth gradient
    const troughColor = isLight ? new THREE.Color(0x1D4ED8) : new THREE.Color(0x020b18);
    const midColor = isLight ? new THREE.Color(0x0284C7) : new THREE.Color(0x00587a);
    const crestColor = isLight ? new THREE.Color(0x38BDF8) : new THREE.Color(0x00f5d4);
    const sprayColor = isLight ? new THREE.Color(0xF8FAFC) : new THREE.Color(0x7dd3fc);

    // Ocean Material: Wet, reflective, with vertex-colored illumination
    const oceanMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: isLight ? 0.14 : 0.18,
      metalness: isLight ? 0.12 : 0.22,
      transparent: true,
      opacity: isLight ? 0.98 : 0.96,
      wireframe: false,
    });

    const oceanMesh = new THREE.Mesh(geo, oceanMat);
    scene.add(oceanMesh);

    // Subtle luminous wireframe overlay for bathymetric contour look
    const wireMat = new THREE.MeshBasicMaterial({
      color: isLight ? 0x0284c7 : 0x00d2ff,
      wireframe: true,
      transparent: true,
      opacity: isLight ? 0.08 : 0.05,
    });
    const wireMesh = new THREE.Mesh(geo.clone(), wireMat);
    wireMesh.position.y = 0.002;
    scene.add(wireMesh);

    // --- Marine Particles ---
    const PARTICLE_COUNT = 200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleScales = new Float32Array(PARTICLE_COUNT);
    const particlePhases = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 26;
      particlePositions[i * 3 + 1] = 0.2 + Math.random() * 2.2;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 26;
      particleScales[i] = 0.04 + Math.random() * 0.08;
      particlePhases[i] = Math.random() * Math.PI * 2;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: isLight ? 0x0284C7 : 0x38bdf8,
      size: 0.09,
      transparent: true,
      opacity: isLight ? 0.45 : 0.65,
      blending: isLight ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- Atmospheric Lights ---
    const ambientLight = new THREE.AmbientLight(isLight ? 0x93C5FD : 0x02162e, isLight ? 1.8 : 1.4);
    scene.add(ambientLight);

    // Main sweeping oceanic beacon
    const mainBeacon = new THREE.DirectionalLight(isLight ? 0x0284C7 : 0x00e5ff, isLight ? 2.8 : 2.4);
    mainBeacon.position.set(5, 12, 7);
    scene.add(mainBeacon);

    // Subsurface glow point light
    const deepGlow = new THREE.PointLight(isLight ? 0x38BDF8 : 0x00a8cc, isLight ? 2.5 : 3.2, 35);
    deepGlow.position.set(-4, 2, -2);
    scene.add(deepGlow);

    // Horizon glint light
    const horizonGlint = new THREE.DirectionalLight(isLight ? 0x60A5FA : 0x38bdf8, isLight ? 1.4 : 1.2);
    horizonGlint.position.set(-8, 6, -10);
    scene.add(horizonGlint);

    // --- Wave Displacement Calculation ---
    function computeWaveHeight(x: number, z: number, t: number): number {
      // Swell 1: Primary long rolling ocean surge
      const w1 = Math.sin(x * 0.35 + z * 0.28 + t * 0.85) * 0.42;

      // Swell 2: Cross sea diagonal swell
      const w2 = Math.sin(-x * 0.26 + z * 0.42 + t * 0.68) * 0.28;

      // Chop 3: Surface wind chop
      const w3 = Math.cos(x * 0.72 - z * 0.55 + t * 1.2) * 0.12;

      // Micro-texture ripples
      const w4 = Math.sin(x * 1.4 + z * 1.1 + t * 1.8) * 0.04;

      return w1 + w2 + w3 + w4;
    }

    // --- Animation Loop ---
    let animId = 0;
    const clock = new THREE.Clock();

    function animate() {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Smooth camera parallax following cursor
      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      camera.position.x = mouse.x * 0.9;
      camera.position.y = 3.8 - mouse.y * 0.45;
      camera.lookAt(mouse.x * 0.3, 0.4, 0);

      // Displace ocean mesh vertices & compute bioluminescent color gradients
      const c = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const x = posArr.getX(i);
        const z = posArr.getZ(i);
        const y = computeWaveHeight(x, z, t);
        posArr.setY(i, y);

        // Normalize height for color blending (-0.6 to +0.8)
        const normH = Math.max(0, Math.min(1, (y + 0.45) / 1.1));

        if (normH < 0.45) {
          // Trough to Mid-depth
          const alpha = normH / 0.45;
          c.copy(troughColor).lerp(midColor, alpha);
        } else if (normH < 0.78) {
          // Mid-depth to Bioluminescent Crest
          const alpha = (normH - 0.45) / 0.33;
          c.copy(midColor).lerp(crestColor, alpha);
        } else {
          // Crest Peak to Spray foam highlight
          const alpha = (normH - 0.78) / 0.22;
          c.copy(crestColor).lerp(sprayColor, alpha);
        }

        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      posArr.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.computeVertexNormals();

      // Sync wireframe mesh
      const wirePos = wireMesh.geometry.attributes.position;
      for (let i = 0; i < count; i++) {
        wirePos.setY(i, posArr.getY(i) + 0.003);
      }
      wirePos.needsUpdate = true;

      // Animate marine motes (organic drifting and vertical hover)
      const pPositions = particles.geometry.attributes.position;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        let px = pPositions.getX(i) + Math.cos(t * 0.2 + particlePhases[i]) * 0.006;
        let pz = pPositions.getZ(i) + Math.sin(t * 0.25 + particlePhases[i]) * 0.006;
        let py = 0.4 + Math.sin(t * 0.8 + particlePhases[i]) * 0.3;

        // Wrap around boundaries
        if (px > 13) px = -13;
        if (px < -13) px = 13;
        if (pz > 13) pz = -13;
        if (pz < -13) pz = 13;

        pPositions.setXYZ(i, px, py, pz);
      }
      pPositions.needsUpdate = true;

      // Light orbit around swell
      deepGlow.position.x = Math.sin(t * 0.3) * 6;
      deepGlow.position.z = Math.cos(t * 0.3) * 6;

      renderer.render(scene, camera);
    }

    animate();

    // --- Resize Handler ---
    const handleResize = () => {
      if (!canvas) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener("resize", handleResize);

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      geo.dispose();
      oceanMat.dispose();
      wireMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block ${className}`}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
