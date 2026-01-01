
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GalaxyParams, GalaxyType, CosmicEvent } from '../types';

interface GalaxySceneProps {
  params: GalaxyParams;
}

const GalaxyScene: React.FC<GalaxySceneProps> = ({ params }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const paramsRef = useRef<GalaxyParams>(params);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    stars: THREE.Points | null;
    additionalParticles: (THREE.Points | THREE.Mesh | THREE.Group)[];
    clock: THREE.Clock;
  } | null>(null);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

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
      const currentParams = paramsRef.current;

      if (sceneRef.current?.stars) {
        if (currentParams.type === CosmicEvent.SUPERNOVA) {
          const positions = sceneRef.current.stars.geometry.attributes.position.array as Float32Array;
          const colors = sceneRef.current.stars.geometry.attributes.color.array as Float32Array;
          const velocities = (sceneRef.current.stars.geometry as any).userData.velocities;
          
          for (let i = 0; i < positions.length / 3; i++) {
            const i3 = i * 3;
            positions[i3] += velocities[i3] * 0.04;
            positions[i3+1] += velocities[i3+1] * 0.04;
            positions[i3+2] += velocities[i3+2] * 0.04;

            const dist = Math.sqrt(positions[i3]**2 + positions[i3+1]**2 + positions[i3+2]**2);
            const heat = Math.max(0, 1 - dist / 18);
            colors[i3] = 1.0; 
            colors[i3+1] = Math.pow(heat, 1.2); 
            colors[i3+2] = Math.pow(heat, 2.5); 

            if (dist > 25) {
              positions[i3] = 0; positions[i3+1] = 0; positions[i3+2] = 0;
            }
          }
          sceneRef.current.stars.geometry.attributes.position.needsUpdate = true;
          sceneRef.current.stars.geometry.attributes.color.needsUpdate = true;
        } else if (currentParams.type === CosmicEvent.QUASAR) {
          // Accretion disk rotation - faster in middle
          const positions = sceneRef.current.stars.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < positions.length / 3; i++) {
            const i3 = i * 3;
            const x = positions[i3];
            const z = positions[i3+2];
            const r = Math.sqrt(x*x + z*z);
            const angle = 0.02 * (5 / (r + 0.5)); // Keplerian speed
            
            positions[i3] = x * Math.cos(angle) - z * Math.sin(angle);
            positions[i3+2] = x * Math.sin(angle) + z * Math.cos(angle);
            // Wobble for turbulence
            positions[i3+1] += Math.sin(elapsedTime * 2 + r) * 0.002;
          }
          sceneRef.current.stars.geometry.attributes.position.needsUpdate = true;
        } else {
          const rotationSpeed = (currentParams.type === GalaxyType.ELLIPTICAL || currentParams.type === GalaxyType.LENTICULAR) ? 0.02 : 0.05;
          sceneRef.current.stars.rotation.y = elapsedTime * rotationSpeed;
        }
      }

      sceneRef.current?.additionalParticles.forEach((obj) => {
        if (obj.name === 'quasar_jet') {
          const positions = (obj as THREE.Points).geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < positions.length; i += 3) {
            positions[i+1] += 0.25; // Super-fast jets
            if (positions[i+1] > 15) {
                positions[i+1] = 0.5;
                positions[i] = (Math.random() - 0.5) * 0.05;
                positions[i+2] = (Math.random() - 0.5) * 0.05;
            }
          }
          (obj as THREE.Points).geometry.attributes.position.needsUpdate = true;
        } else if (obj.name === 'supernova_core' || obj.name === 'quasar_core_glow') {
          const s = 1 + Math.sin(elapsedTime * 8) * 0.2;
          obj.scale.set(s, s, s);
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
    additionalParticles.forEach(p => { 
      scene.remove(p); 
      if ('geometry' in p) p.geometry.dispose(); 
      if ('material' in p) (p.material as THREE.Material).dispose(); 
    });
    sceneRef.current.additionalParticles = [];

    const starTexture = createStarTexture();
    const colorInside = new THREE.Color(params.insideColor);
    const colorOutside = new THREE.Color(params.outsideColor);

    if (params.type === CosmicEvent.SUPERNOVA) {
      const count = 100000;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const velocities = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const speed = 0.8 + Math.pow(Math.random(), 2) * 5.0;

        positions[i3] = (Math.random() - 0.5) * 0.5;
        positions[i3+1] = (Math.random() - 0.5) * 0.5;
        positions[i3+2] = (Math.random() - 0.5) * 0.5;
        
        velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed;
        velocities[i3+1] = Math.sin(phi) * Math.sin(theta) * speed;
        velocities[i3+2] = Math.cos(phi) * speed;
        colors[i3] = 1; colors[i3+1] = 1; colors[i3+2] = 1;
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      (geom as any).userData = { velocities };

      const stars = new THREE.Points(geom, new THREE.PointsMaterial({ 
        size: 0.2, vertexColors: true, map: starTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8, depthWrite: false 
      }));
      scene.add(stars);
      sceneRef.current.stars = stars;

      const core = new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0]), 3)),
        new THREE.PointsMaterial({ size: 12, color: 0xffffff, map: starTexture, transparent: true, blending: THREE.AdditiveBlending })
      );
      core.name = 'supernova_core';
      scene.add(core);
      sceneRef.current.additionalParticles.push(core);

    } else if (params.type === CosmicEvent.QUASAR) {
      // 1. Accretion Disk
      const count = 150000;
      const pos = new Float32Array(count * 3);
      const cols = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const r = 0.8 + Math.pow(Math.random(), 1.5) * 6.0;
        const angle = Math.random() * Math.PI * 2;
        pos[i3] = Math.cos(angle) * r;
        pos[i3+1] = (Math.random() - 0.5) * 0.1 * (1/r); // Flat disk
        pos[i3+2] = Math.sin(angle) * r;

        const mix = colorInside.clone().lerp(colorOutside, r/6);
        cols[i3] = mix.r; cols[i3+1] = mix.g; cols[i3+2] = mix.b;
      }
      const diskGeom = new THREE.BufferGeometry();
      diskGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      diskGeom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const disk = new THREE.Points(diskGeom, new THREE.PointsMaterial({ size: 0.08, vertexColors: true, map: starTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.7, depthWrite: false }));
      scene.add(disk);
      sceneRef.current.stars = disk;

      // 2. Black Hole Core
      const bhGeom = new THREE.SphereGeometry(0.6, 32, 32);
      const bhMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const bh = new THREE.Mesh(bhGeom, bhMat);
      scene.add(bh);
      sceneRef.current.additionalParticles.push(bh);

      // 3. Photon Sphere (Glow around BH)
      const glow = new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0]), 3)),
        new THREE.PointsMaterial({ size: 4, color: 0x00f2ff, map: starTexture, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.8 })
      );
      glow.name = 'quasar_core_glow';
      scene.add(glow);
      sceneRef.current.additionalParticles.push(glow);

      // 4. Relativistic Jets
      const jetCount = 8000;
      const jetPos = new Float32Array(jetCount * 3);
      for(let i=0; i<jetCount; i++) {
        jetPos[i*3] = (Math.random() - 0.5) * 0.06;
        jetPos[i*3+1] = Math.random() * 15;
        jetPos[i*3+2] = (Math.random() - 0.5) * 0.06;
      }
      const jetMat = new THREE.PointsMaterial({ color: 0x00f2ff, size: 0.15, map: starTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.4 });
      const jetTop = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(jetPos, 3)), jetMat);
      jetTop.name = 'quasar_jet';
      const jetBottom = jetTop.clone(); jetBottom.rotation.x = Math.PI;
      scene.add(jetTop, jetBottom);
      sceneRef.current.additionalParticles.push(jetTop, jetBottom);

    } else if (params.type === CosmicEvent.COLLISION) {
      const count = params.starsCount;
      const pos = new Float32Array(count * 3);
      const cols = new Float32Array(count * 3);
      const coreA = new THREE.Vector3(-4, 0, 0);
      const coreB = new THREE.Vector3(4, 1, 2);

      for (let i = 0; i < count; i++) {
        const isGalaxyA = i < count * 0.5;
        const targetCore = isGalaxyA ? coreA : coreB;
        const otherCore = isGalaxyA ? coreB : coreA;
        const r = Math.pow(Math.random(), 1.4) * params.radius;
        const angle = Math.random() * Math.PI * 2;
        const starPos = new THREE.Vector3(Math.cos(angle) * r, (Math.random() - 0.5) * 0.6, Math.sin(angle) * r).add(targetCore);
        
        if (Math.random() > 0.75) starPos.lerp(otherCore, Math.random() * 0.7);

        pos[i*3] = starPos.x; pos[i*3+1] = starPos.y; pos[i*3+2] = starPos.z;
        const mix = colorInside.clone().lerp(colorOutside, r / params.radius);
        cols[i*3] = mix.r; cols[i*3+1] = mix.g; cols[i*3+2] = mix.b;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const stars = new THREE.Points(geom, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, map: starTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8, depthWrite: false }));
      scene.add(stars);
      sceneRef.current.stars = stars;
    } else {
      // Standard Galaxy Generation
      const count = params.starsCount;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const radius = Math.pow(Math.random(), 1.5) * params.radius;
        const spinAngle = radius * params.spin;
        const branchAngle = ((i % params.branches) / params.branches) * Math.PI * 2;
        const totalAngle = spinAngle + branchAngle;

        const rx = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;
        const ry = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;
        const rz = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;

        if (params.type === GalaxyType.ELLIPTICAL) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos((Math.random() * 2) - 1);
          positions[i*3] = Math.sin(phi) * Math.cos(theta) * radius;
          positions[i*3+1] = Math.sin(phi) * Math.sin(theta) * radius * 0.7;
          positions[i*3+2] = Math.cos(phi) * radius * 0.85;
        } else if (params.type === GalaxyType.LENTICULAR) {
          const isBulge = i < count * 0.4;
          if (isBulge) {
            const rb = Math.pow(Math.random(), 2) * (params.radius * 0.35);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            positions[i*3] = Math.sin(phi) * Math.cos(theta) * rb;
            positions[i*3+1] = Math.sin(phi) * Math.sin(theta) * rb * 0.8;
            positions[i*3+2] = Math.cos(phi) * rb;
          } else {
            positions[i*3] = Math.cos(totalAngle) * radius + rx;
            positions[i*3+1] = ry * 0.12;
            positions[i*3+2] = Math.sin(totalAngle) * radius + rz;
          }
        } else {
          positions[i*3] = Math.cos(totalAngle) * radius + rx;
          positions[i*3+1] = ry * 0.3;
          positions[i*3+2] = Math.sin(totalAngle) * radius + rz;
        }

        const mix = colorInside.clone().lerp(colorOutside, radius / params.radius);
        colors[i*3] = mix.r; colors[i*3+1] = mix.g; colors[i*3+2] = mix.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, transparent: true, map: starTexture, opacity: 0.65 }));
      scene.add(stars);
      sceneRef.current.stars = stars;
    }
  }, [params]);

  return <div ref={containerRef} className="fixed inset-0 z-0 bg-slate-950" />;
};

export default GalaxyScene;
