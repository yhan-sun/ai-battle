import * as THREE from 'three';

export class ParallaxBackground {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.farElements = [];
    this.midElements = [];
    this.nearElements = [];

    this.buildFarMountains();
    this.buildMidIslandsAndClouds();
    this.buildNearFoliage();
  }

  buildFarMountains() {
    this.farGroup = new THREE.Group();
    this.group.add(this.farGroup);

    const mtnGeo = new THREE.ConeGeometry(8, 12, 4);
    mtnGeo.rotateY(Math.PI / 4);
    const mtnMat = new THREE.MeshStandardMaterial({
      color: 0x223355,
      roughness: 0.9,
      flatShading: true
    });
    const snowMat = new THREE.MeshBasicMaterial({ color: 0xaaccff });

    // Procedural distant mountain peaks
    for (let i = 0; i < 15; i++) {
      const peakGroup = new THREE.Group();
      const mtn = new THREE.Mesh(mtnGeo, mtnMat);
      const snow = new THREE.Mesh(new THREE.ConeGeometry(3, 4, 4), snowMat);
      snow.position.y = 4.2;
      peakGroup.add(mtn, snow);

      const x = (i - 7) * 20;
      const y = -2 + Math.random() * 3;
      const z = -35 - Math.random() * 10;
      const scale = 1.2 + Math.random() * 0.8;
      peakGroup.scale.set(scale, scale, scale);
      peakGroup.position.set(x, y, z);

      this.farGroup.add(peakGroup);
      this.farElements.push({ group: peakGroup, baseX: x });
    }
  }

  buildMidIslandsAndClouds() {
    this.midGroup = new THREE.Group();
    this.group.add(this.midGroup);

    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      transparent: true,
      opacity: 0.85
    });

    for (let i = 0; i < 16; i++) {
      const cloud = new THREE.Group();
      // Combine 3-4 spheres to form puffy cloud
      for (let j = 0; j < 4; j++) {
        const sphereGeo = new THREE.SphereGeometry(1.2 + Math.random() * 0.8, 8, 8);
        const sphere = new THREE.Mesh(sphereGeo, cloudMat);
        sphere.position.set(j * 1.2 - 1.8, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5);
        cloud.add(sphere);
      }
      const x = (i - 8) * 16;
      const y = 8 + Math.random() * 6;
      const z = -18 - Math.random() * 8;
      cloud.position.set(x, y, z);

      this.midGroup.add(cloud);
      this.midElements.push({ group: cloud, baseX: x, speedOffset: 0.2 + Math.random() * 0.2 });
    }
  }

  buildNearFoliage() {
    this.nearGroup = new THREE.Group();
    this.group.add(this.nearGroup);

    const treeMat = new THREE.MeshStandardMaterial({ color: 0x119955, roughness: 0.8, flatShading: true });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.9 });

    for (let i = 0; i < 24; i++) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.8, 6), trunkMat);
      trunk.position.y = 0.9;
      const foliage = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.6, 6), treeMat);
      foliage.position.y = 2.4;
      tree.add(trunk, foliage);

      const x = (i - 12) * 10;
      const z = -4.5 - Math.random() * 2;
      tree.position.set(x, 0, z);

      this.nearGroup.add(tree);
      this.nearElements.push({ group: tree, baseX: x });
    }
  }

  update(cameraX) {
    // Parallax scrolling: shift elements based on camera position
    const farShift = cameraX * 0.85;
    this.farElements.forEach(el => {
      let relX = (el.baseX - farShift) % 300;
      if (relX < -150) relX += 300;
      el.group.position.x = cameraX + relX;
    });

    const midShift = cameraX * 0.65;
    this.midElements.forEach(el => {
      let relX = (el.baseX - midShift) % 250;
      if (relX < -125) relX += 250;
      el.group.position.x = cameraX + relX;
    });

    const nearShift = cameraX * 0.25;
    this.nearElements.forEach(el => {
      let relX = (el.baseX - nearShift) % 240;
      if (relX < -120) relX += 240;
      el.group.position.x = cameraX + relX;
    });
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}
