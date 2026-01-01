
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
        const geometry = sceneRef.current.stars.geometry;
        const positions = geometry.attributes.position.array as Float32Array;
        const colors = geometry.attributes.color.array as Float32Array;

        if (currentParams.type === CosmicEvent.SUPERNOVA) {
          const velocities = (geometry as any).userData.velocities;
          const duration = 10; // 10 seconds loop
          const progress = (elapsedTime % duration) / duration;
          
          // Reset at start of loop
          if (progress < 0.01) {
            for (let i = 0; i < positions.length; i++) positions[i] = 0;
          }

          for (let i = 0; i < positions.length / 3; i++) {
            const i3 = i * 3;
            // Expand based on velocity and loop progress
            const speedFactor = progress * 15;
            positions[i3] = velocities[i3] * speedFactor;
            positions[i3+1] = velocities[i3+1] * speedFactor;
            positions[i3+2] = velocities[i3+2] * speedFactor;

            // Fade out as it expands
            const alpha = Math.max(0, 1 - progress * 1.2);
            const heat = Math.max(0, 1 - progress * 1.5);
            colors[i3] = 1.0; 
            colors[i3+1] = heat; 
            colors[i3+2] = Math.pow(heat, 2); 
          }
          geometry.attributes.position.needsUpdate = true;
          geometry.attributes.color.needsUpdate = true;
          (sceneRef.current.stars.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - progress * 1.1);

        } else if (currentParams.type === CosmicEvent.QUASAR) {
          for (let i = 0; i < positions.length / 3; i++) {
            const i3 = i * 3;
            const x = positions[i3];
            const z = positions[i3+2];
            const r = Math.sqrt(x*x + z*z);
            const angle = 0.04 * (4 / (r + 0.3));
            positions[i3] = x * Math.cos(angle) - z * Math.sin(angle);
            positions[i3+2] = x * Math.sin(angle) + z * Math.cos(angle);
            positions[i3+1] = Math.sin(elapsedTime * 4 + r * 2) * 0.01;
          }
          geometry.attributes.position.needsUpdate = true;

        } else if (currentParams.type === CosmicEvent.COLLISION) {
          const velocities = (geometry as any).userData.velocities;
          const initialPositions = (geometry as any).userData.initialPositions;
          const isA = (geometry as any).userData.isGalaxyA;
          
          // Oscillate distance between centers: 8 to -8 and back
          const cycleTime = elapsedTime * 0.4;
          const dist = 8 * Math.cos(cycleTime);
          
          const centerA = new THREE.Vector3(dist, 0, 0);
          const centerB = new THREE.Vector3(-dist, 0, 0);

          for (let i = 0; i < positions.length / 3; i++) {
            const i3 = i * 3;
            const targetCenter = isA[i] ? centerA : centerB;
            
            // Particles rotate around their own center
            const rx = initialPositions[i3];
            const rz = initialPositions[i3+2];
            const angle = elapsedTime * 0.5; // Internal rotation
            
            const rotX = rx * Math.cos(angle) - rz * Math.sin(angle);
            const rotZ = rx * Math.sin(angle) + rz * Math.cos(angle);
            
            // Gravity pull when close
            const pull = Math.max(0, 1 - Math.abs(dist) / 5) * 2;
            const driftX = (isA[i] ? -pull : pull);

            positions[i3] = rotX + targetCenter.x + driftX;
            positions[i3+1] = initialPositions[i3+1] + Math.sin(elapsedTime + rx) * 0.2;
            positions[i3+2] = rotZ + targetCenter.z;
          }
          geometry.attributes.position.needsUpdate = true;

        } else {
          const rotationSpeed = (currentParams.type === GalaxyType.ELLIPTICAL || currentParams.type === GalaxyType.LENTICULAR) ? 0.02 : 0.05;
          sceneRef.current.stars.rotation.y = elapsedTime * rotationSpeed;
        }
      }

      sceneRef.current?.additionalParticles.forEach((obj) => {
        if (obj.name === 'quasar_jet') {
          const pts = (obj as THREE.Points).geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < pts.length; i += 3) {
            pts[i+1] += 0.4;
            if (pts[i+1] > 20) {
                pts[i+1] = 0.5;
                pts[i] = (Math.random() - 0.5) * 0.05;
                pts[i+2] = (Math.random() - 0.5) * 0.05;
            }
          }
          (obj as THREE.Points).geometry.attributes.position.needsUpdate = true;
        } else if (obj.name === 'supernova_core') {
          const duration = 10;
          const progress = (elapsedTime % duration) / duration;
          const s = (1 - progress) * 15 * (1 + Math.sin(elapsedTime * 20) * 0.2);
          obj.scale.set(s, s, s);
          (obj as THREE.Points).material.opacity = Math.max(0, 1 - progress * 1.5);
        } else if (obj.name === 'quasar_core_glow') {
          const s = 1 + Math.sin(elapsedTime * 12) * 0.25;
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
      const count = 150000;
      const pos = new Float32Array(count * 3);
      const cols = new Float32Array(count * 3);
      const vels = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const speed = 0.2 + Math.pow(Math.random(), 2) * 4.0;
        vels[i3] = Math.sin(phi) * Math.cos(theta) * speed;
        vels[i3+1] = Math.sin(phi) * Math.sin(theta) * speed;
        vels[i3+2] = Math.cos(phi) * speed;
        cols[i3] = 1; cols[i3+1] = 1; cols[i3+2] = 1;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      (geom as any).userData = { velocities: vels };
      const stars = new THREE.Points(geom, new THREE.PointsMaterial({ size: 0.15, vertexColors: true, map: starTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8, depthWrite: false }));
      scene.add(stars);
      sceneRef.current.stars = stars;

      const core = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0]), 3)), new THREE.PointsMaterial({ size: 2, color: 0xffffff, map: starTexture, transparent: true, blending: THREE.AdditiveBlending }));
      core.name = 'supernova_core';
      scene.add(core);
      sceneRef.current.additionalParticles.push(core);

    } else if (params.type === CosmicEvent.QUASAR) {
      const count = 200000;
      const pos = new Float32Array(count * 3);
      const cols = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const r = 0.5 + Math.pow(Math.random(), 1.2) * 8.0;
        const a = Math.random() * Math.PI * 2;
        pos[i3] = Math.cos(a) * r;
        pos[i3+1] = (Math.random() - 0.5) * 0.15 * (1/r);
        pos[i3+2] = Math.sin(a) * r;
        const mix = colorInside.clone().lerp(colorOutside, r/8);
        cols[i3] = mix.r; cols[i3+1] = mix.g; cols[i3+2] = mix.b;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const disk = new THREE.Points(geom, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, map: starTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8, depthWrite: false }));
      scene.add(disk);
      sceneRef.current.stars = disk;

      const bh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      scene.add(bh);
      sceneRef.current.additionalParticles.push(bh);

      const glow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0]), 3)), new THREE.PointsMaterial({ size: 5, color: 0x00f2ff, map: starTexture, transparent: true, blending: THREE.AdditiveBlending }));
      glow.name = 'quasar_core_glow';
      scene.add(glow);
      sceneRef.current.additionalParticles.push(glow);

      const jPos = new Float32Array(10000 * 3);
      for(let i=0; i<10000; i++) {
        jPos[i*3] = (Math.random() - 0.5) * 0.05; jPos[i*3+1] = Math.random() * 20; jPos[i*3+2] = (Math.random() - 0.5) * 0.05;
      }
      const jetT = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(jPos, 3)), new THREE.PointsMaterial({ color: 0x00f2ff, size: 0.15, map: starTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.4 }));
      jetT.name = 'quasar_jet';
      const jetB = jetT.clone(); jetB.rotation.x = Math.PI;
      scene.add(jetT, jetB);
      sceneRef.current.additionalParticles.push(jetT, jetB);

    } else if (params.type === CosmicEvent.COLLISION) {
      const count = 150000;
      const pos = new Float32Array(count * 3);
      const cols = new Float32Array(count * 3);
      const initialPos = new Float32Array(count * 3);
      const isA = new Uint8Array(count);
      
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const isGalaxyA = i < count * 0.5;
        isA[i] = isGalaxyA ? 1 : 0;
        
        const r = Math.pow(Math.random(), 1.5) * params.radius;
        const a = Math.random() * Math.PI * 2;
        
        // Relative to local center
        initialPos[i3] = Math.cos(a) * r;
        initialPos[i3+1] = (Math.random() - 0.5) * 0.5;
        initialPos[i3+2] = Math.sin(a) * r;

        const mix = colorInside.clone().lerp(colorOutside, r / params.radius);
        if (!isGalaxyA) mix.offsetHSL(0.5, 0, 0); 
        cols[i3] = mix.r; cols[i3+1] = mix.g; cols[i3+2] = mix.b;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      (geom as any).userData = { initialPositions: initialPos, isGalaxyA: isA };
      const stars = new THREE.Points(geom, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, map: starTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8, depthWrite: false }));
      scene.add(stars);
      sceneRef.current.stars = stars;

    } else {
      const count = params.starsCount;
      const pos = new Float32Array(count * 3);
      const cols = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = Math.pow(Math.random(), 1.5) * params.radius;
        const spin = r * params.spin;
        const branch = ((i % params.branches) / params.branches) * Math.PI * 2;
        const total = spin + branch;
        const rx = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * r;
        const ry = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * r;
        const rz = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * r;

        if (params.type === GalaxyType.ELLIPTICAL) {
          const t = Math.random() * Math.PI * 2;
          const p = Math.acos((Math.random() * 2) - 1);
          pos[i*3] = Math.sin(p) * Math.cos(t) * r;
          pos[i*3+1] = Math.sin(p) * Math.sin(t) * r * 0.75;
          pos[i*3+2] = Math.cos(p) * r * 0.9;
        } else if (params.type === GalaxyType.LENTICULAR) {
          if (i < count * 0.4) {
             const rb = Math.pow(Math.random(), 2) * (params.radius * 0.4);
             const t = Math.random() * Math.PI * 2; const p = Math.acos((Math.random() * 2) - 1);
             pos[i*3] = Math.sin(p) * Math.cos(t) * rb; pos[i*3+1] = Math.sin(p) * Math.sin(t) * rb * 0.8; pos[i*3+2] = Math.cos(p) * rb;
          } else {
            pos[i*3] = Math.cos(total) * r + rx; pos[i*3+1] = ry * 0.1; pos[i*3+2] = Math.sin(total) * r + rz;
          }
        } else {
          pos[i*3] = Math.cos(total) * r + rx; pos[i*3+1] = ry * 0.3; pos[i*3+2] = Math.sin(total) * r + rz;
        }
        const mix = colorInside.clone().lerp(colorOutside, r / params.radius);
        cols[i*3] = mix.r; cols[i*3+1] = mix.g; cols[i*3+2] = mix.b;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const stars = new THREE.Points(geom, new THREE.PointsMaterial({ size: 0.05, vertexColors: true, map: starTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.6, depthWrite: false }));
      scene.add(stars);
      sceneRef.current.stars = stars;
    }
  }, [params]);

  return <div ref={containerRef} className="fixed inset-0 z-0 bg-slate-950" />;
};

export default GalaxyScene;
