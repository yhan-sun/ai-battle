import * as THREE from 'three';
import { Biome } from './LevelGenerator.js';

export class ParallaxBackground {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.buildings = [];
    this.superAuras = [];
    this.warpTunnels = [];

    this.buildStarfield();
    this.buildCyberCity();
    this.buildSuperRewardSky();
    this.buildWarpTunnel();
  }

  buildStarfield() {
    const starCount = 350;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 300;
      positions[i3 + 1] = Math.random() * 80 - 10;
      positions[i3 + 2] = -40 - Math.random() * 40;

      const r = 0.5 + Math.random() * 0.5;
      const g = 0.6 + Math.random() * 0.4;
      const b = 1.0;
      colors[i3] = r;
      colors[i3 + 1] = g;
      colors[i3 + 2] = b;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.stars = new THREE.Points(starGeo, starMat);
    this.group.add(this.stars);
  }

  buildCyberCity() {
    this.cityGroup = new THREE.Group();
    this.group.add(this.cityGroup);

    const bldgColors = [0x0F172A, 0x1E1B4B, 0x172554, 0x311042];
    const windowColors = [0x00F0FF, 0xF43F5E, 0xFBBF24, 0x38BDF8];

    // Procedural Skyscrapers
    for (let i = 0; i < 28; i++) {
      const width = 4 + Math.random() * 6;
      const height = 15 + Math.random() * 35;
      const depth = 4 + Math.random() * 6;
      const geo = new THREE.BoxGeometry(width, height, depth);

      const bColor = bldgColors[Math.floor(Math.random() * bldgColors.length)];
      const mat = new THREE.MeshStandardMaterial({
        color: bColor,
        roughness: 0.2,
        metalness: 0.8
      });

      const mesh = new THREE.Mesh(geo, mat);
      const x = i * 10 - 50;
      const y = height / 2 - 12;
      const z = -20 - Math.random() * 15;

      mesh.position.set(x, y, z);
      this.cityGroup.add(mesh);

      // Neon Top Antenna / Beacon
      const antGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 6);
      const antMat = new THREE.MeshBasicMaterial({
        color: windowColors[Math.floor(Math.random() * windowColors.length)]
      });
      const antenna = new THREE.Mesh(antGeo, antMat);
      antenna.position.set(0, height / 2 + 1.5, 0);
      mesh.add(antenna);

      this.buildings.push({ mesh, initialX: x, width, height, z });
    }
  }

  buildSuperRewardSky() {
    this.superGroup = new THREE.Group();
    this.group.add(this.superGroup);
    this.superGroup.visible = false;

    // Golden Halo / Giant Aurora Ring
    const haloGeo = new THREE.TorusGeometry(18, 0.8, 16, 40);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xFDE047,
      wireframe: true
    });
    this.goldenHalo = new THREE.Mesh(haloGeo, haloMat);
    this.goldenHalo.position.set(0, 15, -25);
    this.superGroup.add(this.goldenHalo);

    // Floating Golden Crystals
    for (let i = 0; i < 14; i++) {
      const cGeo = new THREE.OctahedronGeometry(1.8 + Math.random() * 1.5, 0);
      const cMat = new THREE.MeshStandardMaterial({
        color: 0xF59E0B,
        emissive: 0xD97706,
        emissiveIntensity: 0.8,
        wireframe: Math.random() < 0.3
      });
      const crystal = new THREE.Mesh(cGeo, cMat);
      crystal.position.set(i * 12 - 40, 10 + Math.random() * 12, -18 - Math.random() * 10);
      this.superGroup.add(crystal);
      this.superAuras.push({ mesh: crystal, rotY: 0.5 + Math.random() * 1.5 });
    }
  }

  buildWarpTunnel() {
    this.warpGroup = new THREE.Group();
    this.group.add(this.warpGroup);
    this.warpGroup.visible = false;

    // Concentric hyperspace rings
    for (let i = 0; i < 18; i++) {
      const ringGeo = new THREE.TorusGeometry(6.5, 0.08, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x00F0FF : 0x8B5CF6,
        wireframe: true
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.y = Math.PI / 2;
      const x = i * 8 - 20;
      ring.position.set(x, 2.5, 0);
      this.warpGroup.add(ring);
      this.warpTunnels.push(ring);
    }
  }

  setMode(biome) {
    if (biome === Biome.SUPER_REWARD) {
      this.cityGroup.visible = false;
      this.warpGroup.visible = false;
      this.superGroup.visible = true;
    } else if (biome === Biome.WARP_REWARD) {
      this.cityGroup.visible = false;
      this.superGroup.visible = false;
      this.warpGroup.visible = true;
    } else {
      this.cityGroup.visible = true;
      this.superGroup.visible = false;
      this.warpGroup.visible = false;
    }
  }

  update(dt, playerX) {
    // Parallax Starfield follow
    this.stars.position.x = playerX * 0.95;

    // City Parallax wrap-around
    const cityParallaxRatio = 0.4;
    const totalCitySpan = 280;

    for (const b of this.buildings) {
      const relativeX = (b.initialX + playerX * cityParallaxRatio) % totalCitySpan;
      b.mesh.position.x = playerX - (totalCitySpan / 2) + ((relativeX + totalCitySpan) % totalCitySpan);
    }

    // Super Reward Animation
    if (this.superGroup.visible) {
      this.goldenHalo.position.x = playerX + 10;
      this.goldenHalo.rotation.z += dt * 0.4;
      for (const aura of this.superAuras) {
        aura.mesh.rotation.y += dt * aura.rotY;
        aura.mesh.rotation.x += dt * 0.5;
      }
    }

    // Warp Tunnel Animation
    if (this.warpGroup.visible) {
      this.warpGroup.position.x = playerX;
      for (let i = 0; i < this.warpTunnels.length; i++) {
        const ring = this.warpTunnels[i];
        ring.rotation.x += dt * (2.0 + (i % 3));
      }
    }
  }
}
