import * as THREE from 'three';
import { THEMES, REWARD_PALETTES } from './config.js';
import { damp, rand } from './utils.js';

const SKY_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uGlow;
  uniform vec2 uGlowPos;
  varying vec2 vUv;

  void main() {
    vec3 color = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
    float dist = distance(vUv * vec2(1.65, 1.0), uGlowPos * vec2(1.65, 1.0));
    color += uGlow * smoothstep(0.62, 0.0, dist) * 0.38;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function paletteFrom(theme) {
  return {
    top: new THREE.Color(theme.skyTop),
    bottom: new THREE.Color(theme.skyBottom),
    fog: new THREE.Color(theme.fog),
    ground: new THREE.Color(theme.ground),
    groundSide: new THREE.Color(theme.groundSide),
    edge: new THREE.Color(theme.edge),
    accent: new THREE.Color(theme.accent),
    light: new THREE.Color(theme.light),
    hemiSky: new THREE.Color(theme.hemiSky),
    hemiGround: new THREE.Color(theme.hemiGround),
  };
}

/**
 * 环境系统：天空 shader、雾、灯光、四套主题视差层、超级奖励与穿越奖励场景。
 * 主题切换通过颜色阻尼过渡，奖励场景使用独立 backdrop 组与色板。
 */
export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.time = 0;
    this.mode = 'main';
    this.themeIndex = 0;
    this.theme = THEMES[0];

    this.palette = paletteFrom(THEMES[0]);
    this.target = paletteFrom(THEMES[0]);

    this.starTarget = THEMES[0].star;
    this.starOpacity = THEMES[0].star;
    this.fogNearTarget = 46;
    this.fogFarTarget = 185;
    this.lightTarget = {
      hemi: THEMES[0].intensity,
      dir: THEMES[0].dirIntensity,
      fill: 0.55,
    };

    scene.fog = new THREE.Fog(THEMES[0].fog, 46, 185);

    this.hemi = new THREE.HemisphereLight(THEMES[0].hemiSky, THEMES[0].hemiGround, THEMES[0].intensity);
    this.root.add(this.hemi);

    this.sun = new THREE.DirectionalLight(THEMES[0].light, THEMES[0].dirIntensity);
    this.sun.position.set(-16, 28, 22);
    this.root.add(this.sun);

    this.fill = new THREE.DirectionalLight(0x8a6bff, 0.55);
    this.fill.position.set(24, 10, -18);
    this.root.add(this.fill);

    this.buildSky();
    this.buildStars();
    this.buildMainBackdrop();
    this.buildSuperScene();
    this.buildTravelScene();

    this.mainGroup.visible = true;
    this.superGroup.visible = false;
    this.travelGroup.visible = false;

    this._colorA = new THREE.Color();
    this._colorB = new THREE.Color();
  }

  // ------------------------------------------------------------------
  // 构建
  // ------------------------------------------------------------------

  buildSky() {
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: this.palette.top.clone() },
        uBottom: { value: this.palette.bottom.clone() },
        uGlow: { value: this.palette.accent.clone() },
        uGlowPos: { value: new THREE.Vector2(0.73, 0.34) },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      depthWrite: false,
      fog: false,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(620, 340), this.skyMaterial);
    sky.position.set(36, 34, -165);
    sky.frustumCulled = false;
    sky.renderOrder = -20;
    this.sky = sky;
    this.root.add(sky);
  }

  buildStars() {
    const count = 320;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      positions[i3] = rand(-120, 220);
      positions[i3 + 1] = rand(-8, 120);
      positions[i3 + 2] = rand(-150, -85);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xdfefff,
      size: 0.85,
      transparent: true,
      opacity: this.starOpacity,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(geometry, this.starMaterial);
    this.stars.frustumCulled = false;
    this.root.add(this.stars);
  }

  createFarLayer(decor) {
    const group = new THREE.Group();
    group.visible = false;
    this.mainGroup.add(group);

    const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x241b3d, fog: true });
    const neonMaterial = new THREE.MeshBasicMaterial({ color: 0xff3fa4, fog: true, toneMapped: false });
    const crystalMaterial = new THREE.MeshBasicMaterial({ color: 0x39ffd0, fog: true, toneMapped: false });
    this.farMaterials.push(darkMaterial);
    this.neonMaterials.push(neonMaterial);
    this.neonMaterials.push(crystalMaterial);

    const items = [];
    const add = (mesh) => {
      mesh.position.x = rand(-132, 138);
      group.add(mesh);
      items.push(mesh);
    };

    if (decor === 'ridge') {
      for (let i = 0; i < 15; i += 1) {
        const height = rand(18, 46);
        const radius = rand(9, 18);
        const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 4), darkMaterial);
        mesh.position.y = height / 2 - 12;
        mesh.position.z = rand(-112, -82);
        mesh.rotation.y = rand(0, Math.PI);
        mesh.scale.z = rand(0.55, 1.2);
        add(mesh);
      }
      // 远处浮岛
      for (let i = 0; i < 4; i += 1) {
        const island = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(4, 8), 0), darkMaterial);
        island.position.y = rand(10, 26);
        island.position.z = rand(-95, -70);
        island.scale.y = rand(0.35, 0.7);
        add(island);
      }
    } else if (decor === 'city') {
      for (let i = 0; i < 15; i += 1) {
        const width = rand(5, 11);
        const height = rand(18, 62);
        const building = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(width, height, rand(4, 8)), darkMaterial);
        building.add(box);
        for (let j = 0; j < 3; j += 1) {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(0.22, height * rand(0.2, 0.65), 0.1), j === 1 ? crystalMaterial : neonMaterial);
          strip.position.set(rand(-width * 0.3, width * 0.3), rand(-height * 0.2, height * 0.2), 4.05);
          building.add(strip);
        }
        const antenna = new THREE.Mesh(new THREE.BoxGeometry(0.18, rand(3, 9), 0.18), neonMaterial);
        antenna.position.y = height / 2 + 2;
        building.add(antenna);
        building.position.y = height / 2 - 12;
        building.position.z = rand(-105, -78);
        add(building);
      }
    } else if (decor === 'cave') {
      for (let i = 0; i < 16; i += 1) {
        const height = rand(18, 44);
        const radius = rand(4, 10);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 4), darkMaterial);
        cone.rotation.x = Math.PI;
        cone.position.y = 34 - height / 2;
        cone.position.z = rand(-105, -75);
        add(cone);
      }
      for (let i = 0; i < 10; i += 1) {
        const height = rand(8, 22);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(rand(2, 5), height, 4), darkMaterial);
        cone.position.y = -12 + height / 2;
        cone.position.z = rand(-80, -50);
        add(cone);
      }
    } else {
      for (let i = 0; i < 14; i += 1) {
        const height = rand(16, 42);
        const radius = rand(6, 13);
        const prism = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 5), darkMaterial);
        prism.position.y = height / 2 - 12;
        prism.position.z = rand(-115, -80);
        prism.rotation.y = rand(0, Math.PI);
        add(prism);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.2, height * 0.2, 5), crystalMaterial);
        tip.position.y = height - 12;
        tip.position.z = prism.position.z;
        tip.position.x = prism.position.x;
        group.add(tip);
        items.push(tip);
      }
    }

    return { group, items, factor: decor === 'city' ? 0.045 : 0.055, span: 270 };
  }

  buildMainBackdrop() {
    this.mainGroup = new THREE.Group();
    this.root.add(this.mainGroup);
    this.farMaterials = [];
    this.neonMaterials = [];

    this.farLayers = {};
    for (const theme of THEMES) {
      this.farLayers[theme.id] = this.createFarLayer(theme.decor);
    }

    // 中景漂浮岩块
    this.midGroup = new THREE.Group();
    this.mainGroup.add(this.midGroup);
    this.midMaterial = new THREE.MeshStandardMaterial({
      color: 0x5b4a7a,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    });
    this.midItems = [];
    for (let i = 0; i < 12; i += 1) {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.2, 3.6), 0), this.midMaterial);
      rock.position.set(rand(-120, 130), rand(2, 17), rand(-58, -30));
      rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      rock.scale.y = rand(0.5, 1.1);
      this.midGroup.add(rock);
      this.midItems.push(rock);
    }

    // 近景晶体
    this.nearGroup = new THREE.Group();
    this.mainGroup.add(this.nearGroup);
    this.nearMaterial = new THREE.MeshStandardMaterial({
      color: 0x7be8ff,
      emissive: 0x2b9fc4,
      emissiveIntensity: 0.9,
      roughness: 0.25,
      metalness: 0.3,
      transparent: true,
      opacity: 0.8,
    });
    this.nearItems = [];
    for (let i = 0; i < 7; i += 1) {
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(rand(0.25, 0.6), rand(1.6, 4.5), 5), this.nearMaterial);
      crystal.position.set(rand(-120, 130), rand(0.5, 3.5), rand(-15, -9));
      crystal.rotation.z = rand(-0.25, 0.25);
      this.nearGroup.add(crystal);
      this.nearItems.push(crystal);
    }

    // 地心洞顶（仅 cave 主题显示）
    this.ceilingGroup = new THREE.Group();
    this.ceilingGroup.visible = false;
    this.mainGroup.add(this.ceilingGroup);
    this.ceilingMaterial = new THREE.MeshStandardMaterial({
      color: 0x0c2b27,
      roughness: 0.9,
      metalness: 0.1,
    });
    this.ceilingItems = [];
    for (let i = 0; i < 9; i += 1) {
      const height = rand(4, 10);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rand(0.7, 2.0), height, 5), this.ceilingMaterial);
      cone.rotation.x = Math.PI;
      cone.position.set(rand(-110, 120), 15 - height / 2, rand(-2, 6));
      this.ceilingGroup.add(cone);
      this.ceilingItems.push(cone);
    }
  }

  buildSuperScene() {
    this.superGroup = new THREE.Group();
    this.superGroup.visible = false;
    this.root.add(this.superGroup);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(15, 28, 20),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, fog: false, toneMapped: false }),
    );
    sun.position.set(62, 46, -105);
    this.superGroup.add(sun);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(24, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffc93c,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    halo.position.copy(sun.position);
    this.superGroup.add(halo);

    this.cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe8b0,
      emissive: 0xffa53c,
      emissiveIntensity: 0.22,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    });
    this.superClouds = [];
    for (let i = 0; i < 14; i += 1) {
      const cloud = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(3, 7), 0), this.cloudMaterial);
      cloud.position.set(rand(-130, 150), rand(-9, 15), rand(-80, -22));
      cloud.scale.y = rand(0.3, 0.55);
      this.superGroup.add(cloud);
      this.superClouds.push(cloud);
    }

    this.superRings = [];
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffd257, toneMapped: false });
    const ringGlow = new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < 8; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.12, 8, 36), ringMaterial);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(-24 + i * 22, 2.4, 0);
      this.superGroup.add(ring);
      const glow = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.4, 6, 24), ringGlow);
      glow.rotation.y = Math.PI / 2;
      glow.position.copy(ring.position);
      this.superGroup.add(glow);
      this.superRings.push({ ring, glow, offset: i });
    }

    this.superGroup.traverse((object) => {
      if (object.isMesh) object.frustumCulled = false;
    });
  }

  buildTravelScene() {
    this.travelGroup = new THREE.Group();
    this.travelGroup.visible = false;
    this.root.add(this.travelGroup);

    this.travelRings = [];
    const cyan = new THREE.MeshBasicMaterial({ color: 0x63f4ff, toneMapped: false, fog: false });
    const violet = new THREE.MeshBasicMaterial({ color: 0x8a6bff, toneMapped: false, fog: false });
    for (let i = 0; i < 16; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(5.8, 0.12, 8, 40),
        i % 2 === 0 ? cyan : violet,
      );
      ring.rotation.y = Math.PI / 2;
      ring.position.set(-34 + i * 11, 2.6, 0);
      this.travelGroup.add(ring);
      this.travelRings.push(ring);
    }

    // 星尘
    const starCount = 260;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const i3 = i * 3;
      positions[i3] = rand(-80, 160);
      positions[i3 + 1] = rand(-14, 52);
      positions[i3 + 2] = rand(-45, -4);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.travelStarMaterial = new THREE.PointsMaterial({
      color: 0xbfefff,
      size: 0.55,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    this.travelStars = new THREE.Points(starGeometry, this.travelStarMaterial);
    this.travelStars.frustumCulled = false;
    this.travelGroup.add(this.travelStars);
    this.travelStarPositions = positions;

    // 速度线
    const streakCount = 90;
    const streakPositions = new Float32Array(streakCount * 6);
    for (let i = 0; i < streakCount; i += 1) {
      const i6 = i * 6;
      const x = rand(-60, 150);
      const y = rand(-8, 42);
      const z = rand(-60, -12);
      const length = rand(3, 12);
      streakPositions[i6] = x;
      streakPositions[i6 + 1] = y;
      streakPositions[i6 + 2] = z;
      streakPositions[i6 + 3] = x + length;
      streakPositions[i6 + 4] = y;
      streakPositions[i6 + 5] = z;
    }
    const streakGeometry = new THREE.BufferGeometry();
    streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
    this.streakMaterial = new THREE.LineBasicMaterial({
      color: 0x9df7ff,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.travelStreaks = new THREE.LineSegments(streakGeometry, this.streakMaterial);
    this.travelStreaks.frustumCulled = false;
    this.travelGroup.add(this.travelStreaks);
    this.streakPositions = streakPositions;
  }

  // ------------------------------------------------------------------
  // 主题 / 模式
  // ------------------------------------------------------------------

  setTheme(index) {
    this.themeIndex = index % THEMES.length;
    this.theme = THEMES[this.themeIndex];
    this.applyTheme(this.theme);

    for (const theme of THEMES) {
      this.farLayers[theme.id].group.visible = theme.id === this.theme.id;
    }
    this.ceilingGroup.visible = this.theme.decor === 'cave';
    if (this.mode === 'main') {
      this.target = paletteFrom(this.theme);
      this.starTarget = this.theme.star;
    }
    return this.theme;
  }

  applyTheme(theme) {
    const palette = paletteFrom(theme);
    this.target = palette;
    this.starTarget = theme.star;
    this.lightTarget = {
      hemi: theme.intensity,
      dir: theme.dirIntensity,
      fill: 0.55,
    };
    this.fogNearTarget = 46;
    this.fogFarTarget = 185;
  }

  setMode(mode) {
    this.mode = mode;
    this.mainGroup.visible = mode === 'main';
    this.superGroup.visible = mode === 'super';
    this.travelGroup.visible = mode === 'travel';

    if (mode === 'super') {
      this.target = paletteFrom(REWARD_PALETTES.super);
      this.starTarget = 0.05;
      this.lightTarget = { hemi: 1.25, dir: 2.6, fill: 0.4 };
      this.fogNearTarget = 55;
      this.fogFarTarget = 230;
    } else if (mode === 'travel') {
      this.target = paletteFrom(REWARD_PALETTES.travel);
      this.starTarget = 1;
      this.lightTarget = { hemi: 0.9, dir: 1.5, fill: 0.7 };
      this.fogNearTarget = 38;
      this.fogFarTarget = 170;
    } else {
      this.target = paletteFrom(this.theme);
      this.starTarget = this.theme.star;
      this.lightTarget = {
        hemi: this.theme.intensity,
        dir: this.theme.dirIntensity,
        fill: 0.55,
      };
      this.fogNearTarget = 46;
      this.fogFarTarget = 185;
      this.ceilingGroup.visible = this.theme.decor === 'cave';
    }
  }

  // ------------------------------------------------------------------
  // 更新
  // ------------------------------------------------------------------

  update(dt, speed, mode) {
    this.time += dt;
    this.mode = mode;
    const blend = 1 - Math.exp(-2.4 * dt);

    for (const key of Object.keys(this.palette)) {
      this.palette[key].lerp(this.target[key], blend);
    }

    this.skyMaterial.uniforms.uTop.value.copy(this.palette.top);
    this.skyMaterial.uniforms.uBottom.value.copy(this.palette.bottom);
    this.skyMaterial.uniforms.uGlow.value.copy(this.palette.accent);

    this.scene.fog.color.copy(this.palette.fog);
    this.scene.fog.near = damp(this.scene.fog.near, this.fogNearTarget, 2, dt);
    this.scene.fog.far = damp(this.scene.fog.far, this.fogFarTarget, 2, dt);

    this.hemi.color.copy(this.palette.hemiSky);
    this.hemi.groundColor.copy(this.palette.hemiGround);
    this.hemi.intensity = damp(this.hemi.intensity, this.lightTarget.hemi, 2.5, dt);
    this.sun.color.copy(this.palette.light);
    this.sun.intensity = damp(this.sun.intensity, this.lightTarget.dir, 2.5, dt);
    this.fill.intensity = damp(this.fill.intensity, this.lightTarget.fill, 2.5, dt);
    this.fill.color.copy(this.palette.accent);

    this.starOpacity = damp(this.starOpacity, this.starTarget, 2.2, dt);
    this.starMaterial.opacity = this.starOpacity;
    this.stars.visible = this.starOpacity > 0.02;

    this.updateMaterials();

    if (mode === 'main') {
      this.scrollMain(speed, dt);
    } else if (mode === 'super') {
      this.animateSuper(speed, dt);
    } else if (mode === 'travel') {
      this.animateTravel(speed, dt);
    }
  }

  updateMaterials() {
    const farColor = this._colorA
      .copy(this.palette.fog)
      .multiplyScalar(0.34)
      .lerp(this.palette.accent, 0.16);
    for (const material of this.farMaterials) material.color.copy(farColor);

    const neonColor = this._colorB.copy(this.palette.edge).lerp(this.palette.accent, 0.35);
    for (const material of this.neonMaterials) material.color.copy(neonColor);

    this.midMaterial.color.copy(this.palette.fog).multiplyScalar(0.55).lerp(this.palette.accent, 0.28);
    this.nearMaterial.color.copy(this.palette.edge);
    this.nearMaterial.emissive.copy(this.palette.edge).multiplyScalar(0.45);
    this.ceilingMaterial.color.copy(this.palette.groundSide).multiplyScalar(1.4);
    this.cloudMaterial.color.copy(this.palette.edge).lerp(this.palette.accent, 0.5);
  }

  scrollMain(speed, dt) {
    const layer = this.farLayers[this.theme.id];
    const farDx = speed * layer.factor * dt;
    for (const item of layer.items) {
      item.position.x -= farDx;
      if (item.position.x < -138) item.position.x += layer.span;
    }

    const midDx = speed * 0.17 * dt;
    for (const item of this.midItems) {
      item.position.x -= midDx;
      if (item.position.x < -130) item.position.x += 260;
    }

    const nearDx = speed * 0.42 * dt;
    for (const item of this.nearItems) {
      item.position.x -= nearDx;
      if (item.position.x < -128) item.position.x += 256;
    }

    if (this.ceilingGroup.visible) {
      const ceilingDx = speed * 0.85 * dt;
      for (const item of this.ceilingItems) {
        item.position.x -= ceilingDx;
        if (item.position.x < -120) item.position.x += 240;
      }
    }
  }

  animateSuper(speed, dt) {
    for (const cloud of this.superClouds) {
      cloud.position.x -= speed * 0.1 * dt;
      if (cloud.position.x < -140) cloud.position.x += 300;
    }
    for (const item of this.superRings) {
      item.ring.position.x -= speed * dt;
      item.glow.position.x = item.ring.position.x;
      if (item.ring.position.x < -30) {
        item.ring.position.x += 176;
        item.glow.position.x = item.ring.position.x;
      }
      item.ring.rotation.z += dt * 0.5;
      item.glow.rotation.z = item.ring.rotation.z;
    }
    this.superGroup.position.y = Math.sin(this.time * 1.4) * 0.08;
  }

  animateTravel(speed, dt) {
    for (const ring of this.travelRings) {
      ring.position.x -= speed * dt;
      if (ring.position.x < -36) ring.position.x += 176;
      ring.rotation.z += dt * 0.7;
    }

    const positions = this.travelStarPositions;
    const starDx = speed * 0.7 * dt;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] -= starDx;
      if (positions[i] < -85) positions[i] += 245;
    }
    this.travelStars.geometry.attributes.position.needsUpdate = true;

    const streaks = this.streakPositions;
    const streakDx = speed * 1.25 * dt;
    for (let i = 0; i < streaks.length; i += 6) {
      streaks[i] -= streakDx;
      streaks[i + 3] -= streakDx;
      if (streaks[i + 3] < -70) {
        const x = 150 + rand(0, 40);
        const length = rand(3, 12);
        streaks[i] = x;
        streaks[i + 3] = x + length;
        streaks[i + 1] = rand(-8, 42);
        streaks[i + 4] = streaks[i + 1];
        streaks[i + 2] = rand(-60, -12);
        streaks[i + 5] = streaks[i + 2];
      }
    }
    this.travelStreaks.geometry.attributes.position.needsUpdate = true;
  }
}
