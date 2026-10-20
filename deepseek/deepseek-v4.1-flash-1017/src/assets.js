import * as THREE from 'three';

/**
 * 共享几何体与材质库。
 * 所有障碍、拾取物、传送门都由基础几何体组合而成，
 * 通过共享 geometry / material 控制 draw call 与显存占用。
 */
export class Assets {
  constructor() {
    this.geo = {
      box: new THREE.BoxGeometry(1, 1, 1),
      sphere: new THREE.SphereGeometry(1, 18, 12),
      sphereLow: new THREE.SphereGeometry(1, 10, 8),
      ico: new THREE.IcosahedronGeometry(1, 0),
      cone: new THREE.ConeGeometry(1, 1, 6),
      coneLow: new THREE.ConeGeometry(1, 1, 4),
      torus: new THREE.TorusGeometry(1, 0.14, 10, 36),
      torusThin: new THREE.TorusGeometry(1, 0.06, 8, 40),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
      plane: new THREE.PlaneGeometry(1, 1),
    };

    const standard = (params) =>
      new THREE.MeshStandardMaterial({ metalness: 0.35, roughness: 0.55, ...params });

    this.mats = {
      spike: standard({ color: 0x2b2238, emissive: 0xff3355, emissiveIntensity: 0.55, metalness: 0.7, roughness: 0.3 }),
      spikeTip: standard({ color: 0xff6b81, emissive: 0xff2244, emissiveIntensity: 1.4, roughness: 0.25 }),
      crate: standard({ color: 0x2b2144, emissive: 0x5b2bff, emissiveIntensity: 0.4, metalness: 0.55, roughness: 0.4 }),
      crateGlow: standard({ color: 0xb69cff, emissive: 0x7c4dff, emissiveIntensity: 1.5, roughness: 0.3 }),
      bar: standard({ color: 0x3b1e2e, emissive: 0xff2f7a, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.35 }),
      barGlow: standard({ color: 0xff9ecb, emissive: 0xff2f7a, emissiveIntensity: 1.8, roughness: 0.2 }),
      slime: standard({ color: 0x4be3a2, emissive: 0x0b8a5b, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.15 }),
      slimeEye: standard({ color: 0x0b1020, emissive: 0x63f4ff, emissiveIntensity: 0.3, roughness: 0.2 }),
      magnet: standard({ color: 0xff5c8d, emissive: 0xb3174d, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 }),
      magnetTip: standard({ color: 0xd8f6ff, emissive: 0x63f4ff, emissiveIntensity: 1.0, metalness: 0.5, roughness: 0.25 }),
      shield: standard({ color: 0x8ff9ff, emissive: 0x1c9fb8, emissiveIntensity: 1.1, metalness: 0.4, roughness: 0.2, transparent: true, opacity: 0.9 }),
      double: standard({ color: 0xffd257, emissive: 0xa86b00, emissiveIntensity: 1.1, metalness: 0.8, roughness: 0.25 }),
      portal: standard({ color: 0xb46bff, emissive: 0x6a1fff, emissiveIntensity: 1.7, metalness: 0.5, roughness: 0.25 }),
      crystal: standard({ color: 0x7be8ff, emissive: 0x2b9fc4, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.25, transparent: true, opacity: 0.85 }),
    };

    this.glowMats = {
      magenta: new THREE.MeshBasicMaterial({
        color: 0xff4fd8,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      gold: new THREE.MeshBasicMaterial({
        color: 0xffd257,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      cyan: new THREE.MeshBasicMaterial({
        color: 0x63f4ff,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    };
  }

  makeMesh(geometry, material, { position, scale, rotation } = {}) {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(position[0], position[1], position[2]);
    if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    return mesh;
  }

  /** 创建障碍物。返回的 Group 带有碰撞盒 userData。 */
  makeObstacle(type) {
    const group = new THREE.Group();
    let box = { w: 1.4, h: 1.2, ox: 0, oy: 0 };
    let stompable = false;

    if (type === 'spike') {
      const base = this.makeMesh(this.geo.box, this.mats.spike, {
        position: [0, 0.08, 0],
        scale: [1.9, 0.16, 0.9],
      });
      group.add(base);
      for (let i = 0; i < 3; i += 1) {
        const cone = this.makeMesh(this.geo.cone, this.mats.spike, {
          position: [-0.62 + i * 0.62, 0.62, 0],
          scale: [0.3, 1.05, 0.3],
        });
        group.add(cone);
        const tip = this.makeMesh(this.geo.cone, this.mats.spikeTip, {
          position: [-0.62 + i * 0.62, 1.07, 0],
          scale: [0.12, 0.22, 0.12],
        });
        group.add(tip);
      }
      box = { w: 1.9, h: 1.05, ox: 0, oy: 0 };
    } else if (type === 'crate') {
      group.add(
        this.makeMesh(this.geo.box, this.mats.crate, {
          position: [0, 0.68, 0],
          scale: [1.2, 1.36, 1.2],
        }),
      );
      for (let i = 0; i < 3; i += 1) {
        group.add(
          this.makeMesh(this.geo.box, this.mats.crateGlow, {
            position: [0, 0.28 + i * 0.42, 0.61],
            scale: [0.9, 0.055, 0.03],
          }),
        );
      }
      box = { w: 1.28, h: 1.4, ox: 0, oy: 0 };
    } else if (type === 'bar') {
      for (const x of [-1.28, 1.28]) {
        group.add(
          this.makeMesh(this.geo.box, this.mats.bar, {
            position: [x, 0.82, 0],
            scale: [0.18, 1.64, 0.5],
          }),
        );
        group.add(
          this.makeMesh(this.geo.box, this.mats.barGlow, {
            position: [x, 0.72, 0.26],
            scale: [0.08, 1.1, 0.04],
          }),
        );
      }
      group.add(
        this.makeMesh(this.geo.box, this.mats.barGlow, {
          position: [0, 1.34, 0],
          scale: [2.9, 0.15, 0.2],
        }),
      );
      group.add(
        this.makeMesh(this.geo.box, this.mats.bar, {
          position: [0, 1.5, 0],
          scale: [3.0, 0.16, 0.3],
        }),
      );
      box = { w: 2.9, h: 0.42, ox: 0, oy: 1.2 };
    } else if (type === 'laser') {
      for (const x of [-1.35, 1.35]) {
        group.add(
          this.makeMesh(this.geo.box, this.mats.crate, {
            position: [x, 0.8, 0],
            scale: [0.2, 1.6, 0.45],
          }),
        );
      }
      group.add(
        this.makeMesh(this.geo.box, this.mats.barGlow, {
          position: [0, 1.18, 0],
          scale: [2.7, 0.07, 0.07],
        }),
      );
      const halo = this.makeMesh(this.geo.box, this.glowMats.magenta, {
        position: [0, 1.18, 0],
        scale: [2.75, 0.24, 0.24],
      });
      group.add(halo);
      box = { w: 2.7, h: 0.42, ox: 0, oy: 1.15 };
    } else if (type === 'slime') {
      const body = this.makeMesh(this.geo.sphere, this.mats.slime, {
        position: [0, 0.58, 0],
        scale: [0.82, 0.62, 0.68],
      });
      body.name = 'body';
      group.add(body);
      for (const x of [-0.24, 0.24]) {
        group.add(
          this.makeMesh(this.geo.sphereLow, this.mats.slimeEye, {
            position: [x, 0.68, 0.53],
            scale: [0.09, 0.13, 0.08],
          }),
        );
      }
      box = { w: 1.5, h: 1.2, ox: 0, oy: 0 };
      stompable = true;
    } else if (type === 'drone') {
      group.add(
        this.makeMesh(this.geo.ico, this.mats.crateGlow, {
          position: [0, 0.0, 0],
          scale: [0.46, 0.46, 0.46],
        }),
      );
      group.add(
        this.makeMesh(this.geo.torusThin, this.mats.barGlow, {
          position: [0, 0, 0],
          scale: [0.72, 0.72, 0.72],
          rotation: [Math.PI / 2, 0, 0],
        }),
      );
      group.position.y = 2.3;
      box = { w: 1.4, h: 1.4, ox: 0, oy: 1.45 };
      // drone 的碰撞盒以 y=1.6 为中心（需下蹲通过）
    }

    group.userData = {
      kind: 'obstacle',
      type,
      dead: false,
      stompable,
      phase: Math.random() * Math.PI * 2,
      ...box,
    };
    return group;
  }

  makePickup(type) {
    const group = new THREE.Group();
    if (type === 'magnet') {
      const arc = this.makeMesh(this.geo.torus, this.mats.magnet, {
        scale: [0.42, 0.42, 0.42],
        rotation: [0, 0, Math.PI],
      });
      group.add(arc);
      group.add(
        this.makeMesh(this.geo.box, this.mats.magnetTip, {
          position: [-0.42, -0.3, 0],
          scale: [0.18, 0.24, 0.18],
        }),
      );
      group.add(
        this.makeMesh(this.geo.box, this.mats.magnetTip, {
          position: [0.42, -0.3, 0],
          scale: [0.18, 0.24, 0.18],
        }),
      );
    } else if (type === 'shield') {
      group.add(this.makeMesh(this.geo.ico, this.mats.shield, { scale: [0.52, 0.52, 0.52] }));
      group.add(
        this.makeMesh(this.geo.torusThin, this.mats.magnetTip, {
          scale: [0.7, 0.7, 0.7],
          rotation: [Math.PI / 2, 0, 0],
        }),
      );
    } else {
      group.add(
        this.makeMesh(this.geo.ico, this.mats.double, {
          scale: [0.45, 0.45, 0.45],
          rotation: [0, 0, Math.PI / 4],
        }),
      );
      group.add(
        this.makeMesh(this.geo.torusThin, this.mats.double, {
          scale: [0.72, 0.72, 0.72],
          rotation: [Math.PI / 2, 0, 0],
        }),
      );
    }

    const haloMat = type === 'shield' ? this.glowMats.cyan : type === 'double' ? this.glowMats.gold : this.glowMats.magenta;
    group.add(
      this.makeMesh(this.geo.sphereLow, haloMat, {
        scale: [0.8, 0.8, 0.8],
      }),
    );

    group.userData = {
      kind: 'pickup',
      type,
      dead: false,
      phase: Math.random() * Math.PI * 2,
      w: 1.1,
      h: 1.1,
    };
    return group;
  }

  makePortal() {
    const group = new THREE.Group();
    const ring = this.makeMesh(this.geo.torus, this.mats.portal, {
      scale: [1.5, 1.5, 1.5],
    });
    group.add(ring);
    const ring2 = this.makeMesh(this.geo.torusThin, this.mats.barGlow, {
      scale: [1.72, 1.72, 1.72],
      rotation: [0, 0, 0.4],
    });
    group.add(ring2);

    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(1.42, 32),
      new THREE.MeshBasicMaterial({
        color: 0x9b7bff,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    group.add(disk);
    group.add(
      this.makeMesh(this.geo.sphereLow, this.glowMats.magenta, {
        scale: [2.0, 2.0, 0.4],
      }),
    );

    group.userData = {
      kind: 'portal',
      dead: false,
      phase: 0,
      w: 3.3,
      h: 3.3,
    };
    return group;
  }

  makeCrystal() {
    const group = new THREE.Group();
    const shard = this.makeMesh(this.geo.coneLow, this.mats.crystal, {
      scale: [0.32, 1.4, 0.32],
      rotation: [0, 0, 0.24],
    });
    group.add(shard);
    const shard2 = this.makeMesh(this.geo.coneLow, this.mats.crystal, {
      position: [0.3, -0.2, 0.1],
      scale: [0.18, 0.8, 0.18],
      rotation: [0, 0, -0.32],
    });
    group.add(shard2);
    return group;
  }
}
