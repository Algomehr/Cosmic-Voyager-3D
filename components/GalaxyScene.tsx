
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GalaxyParams, GalaxyType, CosmicEvent } from '../types';

interface GalaxySceneProps {
  params: GalaxyParams;
}

const GalaxyScene: React.FC<GalaxySceneProps> = ({ params }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    stars: THREE.Points | null;
    additionalParticles: THREE.Points[];
    clock: THREE.Clock;
  } | null>(null);

  const createStarTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(12, 10, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x020617, 1);
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    const clock = new THREE.Clock();
    sceneRef.current = { renderer, scene, camera, stars: null, additionalParticles: [], clock };

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      if (sceneRef.current?.stars) {
        sceneRef.current.stars.rotation.y = elapsedTime * 0.05;
      }

      sceneRef.current?.additionalParticles.forEach((points) => {
        if (points.name === 'quasar_jet') {
          const positions = points.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < positions.length; i += 3) {
            positions[i+1] += 0.15; // Velocity of jet
            // Add some magnetic spiraling
            positions[i] += Math.sin(elapsedTime * 5 + positions[i+1]) * 0.02;
            positions[i+2] += Math.cos(elapsedTime * 5 + positions[i+1]) * 0.02;
            
            if (positions[i+1] > 12) {
                positions[i+1] = 0;
                positions[i] = (Math.random() - 0.5) * 0.1;
                positions[i+2] = (Math.random() - 0.5) * 0.1;
            }
          }
          points.geometry.attributes.position.needsUpdate = true;
        }

        if (points.name === 'supernova_explosion') {
          const positions = points.geometry.attributes.position.array as Float32Array;
          const velocities = points.userData.velocities;
          const sizes = points.geometry.attributes.size.array as Float32Array;
          
          for (let i = 0; i < positions.length; i += 3) {
            positions[i] += velocities[i] * 0.015;
            positions[i+1] += velocities[i+1] * 0.015;
            positions[i+2] += velocities[i+2] * 0.015;
            
            // Fade particles out
            if (i/3 < sizes.length) {
                sizes[i/3] *= 0.997;
            }
          }
          points.geometry.attributes.position.needsUpdate = true;
          points.geometry.attributes.size.needsUpdate = true;
          (points.material as THREE.PointsMaterial).opacity *= 0.999;
        }

        if (points.name === 'accretion_disk') {
           points.rotation.y = elapsedTime * 8; // Ultra fast rotation
        }

        if (points.name === 'collision_system') {
            points.rotation.y = elapsedTime * (points.userData.spinDir || 1) * 0.1;
        }
      });

      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    const { scene, stars: oldStars, additionalParticles } = sceneRef.current;

    if (oldStars) { scene.remove(oldStars); oldStars.geometry.dispose(); (oldStars.material as THREE.Material).dispose(); }
    additionalParticles.forEach(p => { scene.remove(p); p.geometry.dispose(); (p.material as THREE.Material).dispose(); });
    sceneRef.current.additionalParticles = [];

    const starTexture = createStarTexture();
    const colorInside = new THREE.Color(params.insideColor);
    const colorOutside = new THREE.Color(params.outsideColor);

    if (params.type === CosmicEvent.COLLISION) {
        // Shifting to a dual-system simulation with tidal distortions
        const createSystem = (offset: number, spinDir: number, colors: [string, string]) => {
            const count = params.starsCount / 2;
            const pos = new Float32Array(count * 3);
            const cols = new Float32Array(count * 3);
            const cIn = new THREE.Color(colors[0]);
            const cOut = new THREE.Color(colors[1]);

            for(let i=0; i<count; i++) {
                const r = Math.pow(Math.random(), 1.5) * params.radius;
                const angle = Math.random() * Math.PI * 2;
                const spin = r * params.spin * spinDir;
                
                // Scientifically: stars further out are more distorted by the other galaxy
                const tidalStretch = Math.pow(r / params.radius, 3) * 2;
                const x = Math.cos(angle + spin) * r + offset;
                const y = (Math.random() - 0.5) * 0.4 * (1 + tidalStretch);
                const z = Math.sin(angle + spin) * r;

                pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z;
                const mc = cIn.clone().lerp(cOut, r/params.radius);
                cols[i*3] = mc.r; cols[i*3+1] = mc.g; cols[i*3+2] = mc.b;
            }
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
            const mat = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, map: starTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.7, depthWrite: false });
            const p = new THREE.Points(geom, mat);
            p.name = 'collision_system';
            p.userData = { spinDir };
            return p;
        };

        const sys1 = createSystem(-4, 1, ['#4cc9f0', '#4361ee']);
        const sys2 = createSystem(4, -1, ['#f72585', '#b5179e']);
        scene.add(sys1, sys2);
        sceneRef.current.additionalParticles.push(sys1, sys2);
    } else {
        // Regular Galaxy
        const starCount = params.starsCount;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
          const radius = Math.pow(Math.random(), 1.5) * params.radius;
          const spinAngle = radius * params.spin;
          const branchAngle = ((i % params.branches) / params.branches) * Math.PI * 2;
          const totalAngle = spinAngle + branchAngle;

          const randomX = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;
          const randomY = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;
          const randomZ = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;

          positions[i*3] = Math.cos(totalAngle) * radius + randomX;
          positions[i*3+1] = randomY * 0.3;
          positions[i*3+2] = Math.sin(totalAngle) * radius + randomZ;

          const mixedColor = colorInside.clone().lerp(colorOutside, radius / params.radius);
          colors[i*3] = mixedColor.r; colors[i*3+1] = mixedColor.g; colors[i*3+2] = mixedColor.b;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({ size: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, transparent: true, map: starTexture, opacity: 0.6 });
        const stars = new THREE.Points(geometry, material);
        scene.add(stars);
        sceneRef.current.stars = stars;
    }

    // --- EVENT SPECIFIC OVERLAYS ---
    if (params.type === CosmicEvent.QUASAR) {
      // 1. Accretion Disk - Hotter near center (white -> cyan)
      const diskCount = 15000;
      const diskPos = new Float32Array(diskCount * 3);
      const diskColors = new Float32Array(diskCount * 3);
      for(let i=0; i<diskCount; i++) {
        const r = Math.pow(Math.random(), 0.5) * 1.8 + 0.15;
        const a = Math.random() * Math.PI * 2;
        diskPos[i*3] = Math.cos(a) * r;
        diskPos[i*3+1] = (Math.random() - 0.5) * 0.02;
        diskPos[i*3+2] = Math.sin(a) * r;
        const c = new THREE.Color(0xffffff).lerp(new THREE.Color(0x00f2ff), r/1.8);
        diskColors[i*3] = c.r; diskColors[i*3+1] = c.g; diskColors[i*3+2] = c.b;
      }
      const diskGeom = new THREE.BufferGeometry();
      diskGeom.setAttribute('position', new THREE.BufferAttribute(diskPos, 3));
      diskGeom.setAttribute('color', new THREE.BufferAttribute(diskColors, 3));
      const diskPoints = new THREE.Points(diskGeom, new THREE.PointsMaterial({ size: 0.04, vertexColors: true, map: starTexture, blending: THREE.AdditiveBlending, transparent: true }));
      diskPoints.name = 'accretion_disk';
      scene.add(diskPoints);
      sceneRef.current.additionalParticles.push(diskPoints);

      // 2. Relativistic Jets
      const jetCount = 4000;
      const jetPos = new Float32Array(jetCount * 3);
      for(let i=0; i<jetCount; i++) {
        jetPos[i*3] = (Math.random() - 0.5) * 0.15;
        jetPos[i*3+1] = Math.random() * 12;
        jetPos[i*3+2] = (Math.random() - 0.5) * 0.15;
      }
      const jetGeom = new THREE.BufferGeometry();
      jetGeom.setAttribute('position', new THREE.BufferAttribute(jetPos, 3));
      const jetPointsTop = new THREE.Points(jetGeom, new THREE.PointsMaterial({ color: 0x00f2ff, size: 0.1, map: starTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5 }));
      jetPointsTop.name = 'quasar_jet';
      const jetPointsBottom = jetPointsTop.clone();
      jetPointsBottom.rotation.x = Math.PI;
      scene.add(jetPointsTop, jetPointsBottom);
      sceneRef.current.additionalParticles.push(jetPointsTop, jetPointsBottom);

      // 3. Central Event Horizon (Black Sphere)
      const bh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      scene.add(bh);
      sceneRef.current.additionalParticles.push(bh as any);
    }

    if (params.type === CosmicEvent.SUPERNOVA) {
      const expCount = 25000;
      const expPos = new Float32Array(expCount * 3);
      const velocities = new Float32Array(expCount * 3);
      const sizes = new Float32Array(expCount);
      const expColors = new Float32Array(expCount * 3);
      
      for(let i=0; i<expCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const speed = (Math.random() * 6 + 4) * (Math.random() > 0.9 ? 1.5 : 1); // Shock front speed

        velocities[i*3] = Math.sin(phi) * Math.cos(theta) * speed;
        velocities[i*3+1] = Math.sin(phi) * Math.sin(theta) * speed;
        velocities[i*3+2] = Math.cos(phi) * speed;

        expPos[i*3] = 2.5; expPos[i*3+1] = 0.5; expPos[i*3+2] = 1.2;
        sizes[i] = Math.random() * 0.15 + 0.05;

        const c = new THREE.Color().setHSL(Math.random() * 0.1 + 0.05, 1, 0.6);
        expColors[i*3] = c.r; expColors[i*3+1] = c.g; expColors[i*3+2] = c.b;
      }
      
      const expGeom = new THREE.BufferGeometry();
      expGeom.setAttribute('position', new THREE.BufferAttribute(expPos, 3));
      expGeom.setAttribute('color', new THREE.BufferAttribute(expColors, 3));
      expGeom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      const expPoints = new THREE.Points(expGeom, new THREE.PointsMaterial({ size: 0.1, vertexColors: true, map: starTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9 }));
      expPoints.name = 'supernova_explosion';
      expPoints.userData = { velocities };
      scene.add(expPoints);
      sceneRef.current.additionalParticles.push(expPoints);
    }

  }, [params]);

  return <div ref={containerRef} className="fixed inset-0 z-0 bg-slate-950" />;
};

export default GalaxyScene;
