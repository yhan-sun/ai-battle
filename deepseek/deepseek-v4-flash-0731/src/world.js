import * as THREE from 'three';
import { CONFIG } from './config.js';

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CONFIG.cameraFov, window.innerWidth / window.innerHeight, 0.1, 600);
    this.camera.position.set(0, CONFIG.cameraY, CONFIG.cameraZ);
    this.camera.lookAt(0, CONFIG.cameraLookY, 0);

    this.shake = 0;
    this.fovTarget = CONFIG.cameraFov;
    this.fovBase = CONFIG.cameraFov;
    this.theme = 'day';
    this._skyDome = null;
    this._fog = null;
    this._parallax = [];
    this._buildLights();
    this._buildSky();
    this._buildParallax();
    this._buildTrack();

    window.addEventListener('resize', () => this.onResize());
  }

  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0xbfd8ff, 0.9));
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
    sun.position.set(20, 30, 18);
    this.scene.add(sun);
    this.sun = sun;
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(220, 24, 16);
    this._skyDome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false }));
    this._skyDome.renderOrder = -10;
    this.scene.add(this._skyDome);
    this._fog = new THREE.Fog(0x9fd8ff, 120, 420);
    this.scene.fog = this._fog;
  }

  setTheme(theme, t = 1) {
    this.theme = theme;
    const palettes = {
      day: {
        sky: 0x9fd8ff, sun: 0xfff2d8, ambient: 0xbfd8ff, fog: 0x9fd8ff,
        track: 0x2f9bd8, trackSide: 0x1f7ab0, ground: 0x3fae62, accent: 0x37e6ff,
        horizon: 0x7fb8dd, star: null,
      },
      sunset: {
        sky: 0xff9a5e, sun: 0xffd0a0, ambient: 0xffc8a0, fog: 0xff9a5e,
        track: 0x8a5bb0, trackSide: 0x6a4490, ground: 0x7a5aa0, accent: 0xffc857,
        horizon: 0xe0855a, star: null,
      },
      underground: {
        sky: 0x1a1028, sun: 0x8a5aff, ambient: 0x5a4a88, fog: 0x1a1028,
        track: 0x4a3a6a, trackSide: 0x382a50, ground: 0x3a2f5a, accent: 0xb07fff,
        horizon: 0x241838, star: true,
      },
      bonus: {
        sky: 0x0a1a2e, sun: 0x66eeff, ambient: 0x44aaff, fog: 0x0a1a2e,
        track: 0x0f3050, trackSide: 0x0a2440, ground: 0x115040, accent: 0x5fffd0,
        horizon: 0x0e2840, star: true,
      },
      warp: {
        sky: 0x05030f, sun: 0xb06bff, ambient: 0x6a3aff, fog: 0x05030f,
        track: 0x2a1860, trackSide: 0x1c1048, ground: 0x1a1250, accent: 0xb06bff,
        horizon: 0x140a30, star: true,
      },
    };
    const p = palettes[theme] || palettes.day;
    this._skyDome.material.color.setHex(p.sky);
    this.sun.color.setHex(p.sun);
    this._fog.color.setHex(p.fog);
    this._fog.near = theme === 'warp' ? 60 : 120;
    this._fog.far = theme === 'warp' ? 240 : 420;
    this.scene.ambientLight.color.setHex(p.ambient);
    this.trackMat.color.setHex(p.track);
    this.trackSideMat.color.setHex(p.trackSide);
    this.trackGlow.color.setHex(p.accent);
    this.trackGlow.material.color.setHex(p.accent);
    this._parallax.forEach((layer) => {
      if (layer.base) layer.base.color.setHex(p.horizon);
      layer.material.color.setHex(p.horizon);
    });
    if (p.star) {
      if (!this._stars) {
        const sg = new THREE.BufferGeometry();
        const n = 300;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          pos[i * 3] = (Math.random() - 0.5) * 400;
          pos[i * 3 + 1] = Math.random() * 140 + 10;
          pos[i * 3 + 2] = -Math.random() * 300 - 30;
        }
        sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this._stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, fog: false, transparent: true, opacity: 0.85 }));
        this._stars.renderOrder = -5;
        this.scene.add(this._stars);
      }
      this._stars.material.opacity = 0.85;
    } else if (this._stars) {
      this._stars.material.opacity = 0;
    }
  }

  _buildParallax() {
    const layers = [
      { count: 26, height: 34, width: 130, z: -50, size: [10, 26], color: 0x7fb8dd, speed: 0.12 },
      { count: 18, height: 22, width: 100, z: -34, size: [7, 16], color: 0x6aa7cf, speed: 0.2 },
      { count: 10, height: 12, width: 70, z: -20, size: [5, 10], color: 0x5496c0, speed: 0.34 },
    ];
    layers.forEach((cfg) => {
      const group = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: cfg.color, fog: true });
      for (let i = 0; i < cfg.count; i++) {
        const w = cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]);
        const h = cfg.size[1] + Math.random() * cfg.size[0];
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), mat);
        mesh.position.set((Math.random() - 0.5) * cfg.width * 2, h / 2 - 0.5, cfg.z + (Math.random() - 0.5) * 6);
        group.add(mesh);
      }
      this.scene.add(group);
      this._parallax.push({ group, mat, base: mat, speed: cfg.speed, cfg });
    });
  }

  _buildTrack() {
    this.trackMat = new THREE.MeshStandardMaterial({ color: 0x2f9bd8, roughness: 0.55, metalness: 0.25 });
    this.trackSideMat = new THREE.MeshStandardMaterial({ color: 0x1f7ab0, roughness: 0.7 });
    const trackWidth = CONFIG.laneCount * CONFIG.laneWidth + 1.6;
    this.track = new THREE.Mesh(new THREE.BoxGeometry(400, 0.8, trackWidth), this.trackMat);
    this.track.position.set(0, -0.4, 0);
    this.scene.add(this.track);

    this.ground = new THREE.Mesh(
      new THREE.BoxGeometry(400, 26, 90),
      new THREE.MeshStandardMaterial({ color: 0x3fae62, roughness: 0.9 })
    );
    this.ground.position.set(0, -13.5, 0);
    this.ground.material.color.setHex(0x3fae62);
    this.groundMat = this.ground.material;
    this.scene.add(this.ground);

    const sideGeo = new THREE.BoxGeometry(400, 1.1, 1.2);
    this.sideL = new THREE.Mesh(sideGeo, this.trackSideMat);
    this.sideL.position.set(0, 0.15, -trackWidth / 2 - 0.6);
    this.scene.add(this.sideL);
    this.sideR = new THREE.Mesh(sideGeo, this.trackSideMat);
    this.sideR.position.set(0, 0.15, trackWidth / 2 + 0.6);
    this.scene.add(this.sideR);

    this.trackGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(400, trackWidth * 0.92),
      new THREE.MeshBasicMaterial({ color: 0x37e6ff, transparent: true, opacity: 0.06, depthWrite: false })
    );
    this.trackGlow.rotation.x = -Math.PI / 2;
    this.trackGlow.position.set(0, 0.42, 0);
    this.scene.add(this.trackGlow);
  }

  update(player, speed, dt, running) {
    const camX = player.position.x;
    const laneZ = player.position.z;
    this.camera.position.x += (camX - this.camera.position.x) * Math.min(1, dt * 6);
    this.camera.position.z += (laneZ * 0.35 + CONFIG.cameraZ - this.camera.position.z) * Math.min(1, dt * 4);
    this.camera.position.y += (CONFIG.cameraY - player.position.y * 0.08 - this.camera.position.y) * Math.min(1, dt * 3);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3);
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.4;
      this.camera.position.z += (Math.random() - 0.5) * this.shake * 0.3;
    }

    this.camera.fov += (this.fovTarget - this.camera.fov) * Math.min(1, dt * 5);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(camX, CONFIG.cameraLookY, 0);

    this._parallax.forEach((layer) => {
      layer.group.position.x = camX * layer.speed;
      const first = layer.group.children[0];
      if (first) {
        const span = layer.cfg.width * 2;
        const off = ((camX * layer.speed) % span);
        layer.group.children.forEach((c, i) => {
          const baseX = (i / layer.group.children.length) * span - span / 2 - off;
          c.position.x = baseX;
        });
      }
    });

    if (this._stars && running) this._stars.position.x = camX * 0.05;
  }

  shakeAmount(v) {
    this.shake = Math.max(this.shake, v);
  }

  setFovBase(v) {
    this.fovBase = v;
    this.fovTarget = v;
  }

  setFovBoost(v) {
    this.fovTarget = this.fovBase + v;
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}