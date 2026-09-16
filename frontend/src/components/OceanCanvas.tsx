import { useEffect, useRef } from "react";
import * as THREE from "three";

/** 3D animated ocean surface for ORCA landing page.
 *  A vertex-displaced sine-wave mesh with a sonar sweep overlay.
 *  Rendered to a fixed full-screen canvas behind all page content.
 */
export default function OceanCanvas({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setClearColor(0x000000, 0);

    // --- Scene & Camera ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 4.5, 8);
    camera.lookAt(0, 0, 0);

    // --- Ocean mesh ---
    const SEGS = 80;
    const geo = new THREE.PlaneGeometry(20, 20, SEGS, SEGS);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x003D52),
      wireframe: false,
      transparent: true,
      opacity: 0.55,
      roughness: 0.9,
      metalness: 0.1,
    });

    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    // Wireframe overlay
    const wireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x00A8CC),
      wireframe: true,
      transparent: true,
      opacity: 0.06,
    });
    const wireMesh = new THREE.Mesh(geo.clone(), wireMat);
    scene.add(wireMesh);

    // --- Sonar rings ---
    const RINGS = 4;
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < RINGS; i++) {
      const ringGeo = new THREE.RingGeometry(0, 0.1, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x00E5FF),
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      ring.userData.phase = (i / RINGS) * Math.PI * 2;
      scene.add(ring);
      rings.push(ring);
    }

    // --- Floating particles (ocean debris / plankton) ---
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 18;
      positions[i * 3 + 1] = Math.random() * 0.3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 18;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00C3E8,
      size: 0.05,
      transparent: true,
      opacity: 0.45,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x001A2E, 0.8);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x00A8CC, 1.5, 30);
    pointLight.position.set(0, 6, 2);
    scene.add(pointLight);

    // --- Animation ---
    let animId = 0;
    const clock = new THREE.Clock();
    const posArr = geo.attributes.position;
    const origY = new Float32Array(posArr.count);
    for (let i = 0; i < posArr.count; i++) {
      origY[i] = 0; // flat start
    }

    function animate() {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Wave displacement
      for (let i = 0; i < posArr.count; i++) {
        const x = posArr.getX(i);
        const z = posArr.getZ(i);
        const y =
          Math.sin(x * 0.5 + t * 0.8) * 0.22 +
          Math.sin(z * 0.6 + t * 0.6) * 0.18 +
          Math.sin((x + z) * 0.3 + t * 1.1) * 0.12;
        posArr.setY(i, y);
      }
      posArr.needsUpdate = true;
      geo.computeVertexNormals();

      // Sync wireframe
      const wirePos = wireMesh.geometry.attributes.position;
      for (let i = 0; i < posArr.count; i++) {
        wirePos.setY(i, posArr.getY(i));
      }
      wirePos.needsUpdate = true;

      // Sonar rings expand
      rings.forEach((ring) => {
        const phase = ring.userData.phase;
        const cycleT = ((t * 0.4 + phase / (Math.PI * 2)) % 1);
        const scale = cycleT * 12;
        ring.scale.set(scale, scale, scale);
        (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.35 * (1 - cycleT));
      });

      // Drift particles
      const pPos = particles.geometry.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        let px = pPos.getX(i) + 0.005;
        if (px > 9) px = -9;
        pPos.setX(i, px);
      }
      pPos.needsUpdate = true;

      renderer.render(scene, camera);
    }
    animate();

    // --- Resize ---
    function onResize() {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      wireMat.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
