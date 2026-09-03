import * as THREE from 'three';

export const MOUNT_TYPES = {
  NONE: 'none',
  PANTHER: 'panther',    // Cyber Panther: Triple Jump + 25% score
  BIKE: 'bike',          // Hyper Hoverbike: Slide Ram + Dash duration boost
  WYVERN: 'wyvern'       // Candy Wyvern: Bonus Candy Gem conversion + coin boost
};

export class Mount {
  constructor(type = MOUNT_TYPES.PANTHER) {
    this.type = type;
    this.mesh = new THREE.Group();
    this.animTime = 0;
    this.legPairs = [];
    this.specialParts = [];
    this.buildModel();
  }

  buildModel() {
    // Clear previous children
    while (this.mesh.children.length > 0) {
      this.mesh.remove(this.mesh.children[0]);
    }
    this.legPairs = [];
    this.specialParts = [];

    if (this.type === MOUNT_TYPES.NONE) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    if (this.type === MOUNT_TYPES.PANTHER) {
      this.buildCyberPanther();
    } else if (this.type === MOUNT_TYPES.BIKE) {
      this.buildHyperBike();
    } else if (this.type === MOUNT_TYPES.WYVERN) {
      this.buildCandyWyvern();
    }
  }

  setType(newType) {
    this.type = newType;
    this.buildModel();
  }

  // --- MODEL 1: CYBER PANTHER ---
  buildCyberPanther() {
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.3,
      metalness: 0.8
    });
    const neonOrange = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      roughness: 0.2,
      metalness: 0.9
    });

    // Body / Torso
    const bodyGeo = new THREE.BoxGeometry(1.6, 0.6, 0.7);
    const body = new THREE.Mesh(bodyGeo, darkMat);
    body.position.set(0, 0.6, 0);
    this.mesh.add(body);

    // Glowing spine accents
    const spineGeo = new THREE.BoxGeometry(1.2, 0.1, 0.15);
    const spine = new THREE.Mesh(spineGeo, neonOrange);
    spine.position.set(0, 0.95, 0);
    this.mesh.add(spine);

    // Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0.9, 0.85, 0);
    const headGeo = new THREE.BoxGeometry(0.65, 0.45, 0.5);
    const head = new THREE.Mesh(headGeo, darkMat);
    headGroup.add(head);

    // Ears
    const earGeo = new THREE.ConeGeometry(0.12, 0.3, 4);
    earGeo.rotateZ(-0.2);
    const earL = new THREE.Mesh(earGeo, goldMat);
    earL.position.set(0.1, 0.35, 0.2);
    const earR = new THREE.Mesh(earGeo, goldMat);
    earR.position.set(0.1, 0.35, -0.2);
    headGroup.add(earL, earR);

    // Glowing Eyes
    const eyeGeo = new THREE.BoxGeometry(0.15, 0.08, 0.08);
    const eyeL = new THREE.Mesh(eyeGeo, neonOrange);
    eyeL.position.set(0.3, 0.08, 0.18);
    const eyeR = new THREE.Mesh(eyeGeo, neonOrange);
    eyeR.position.set(0.3, 0.08, -0.18);
    headGroup.add(eyeL, eyeR);

    this.mesh.add(headGroup);
    this.specialParts.push(headGroup);

    // Tail
    const tailGroup = new THREE.Group();
    tailGroup.position.set(-0.8, 0.8, 0);
    const tailGeo = new THREE.CylinderGeometry(0.06, 0.03, 0.9, 6);
    tailGeo.rotateZ(Math.PI / 4);
    const tail = new THREE.Mesh(tailGeo, goldMat);
    tail.position.set(-0.35, 0.25, 0);
    tailGroup.add(tail);
    this.mesh.add(tailGroup);
    this.tail = tailGroup;

    // 4 Legs
    const legGeo = new THREE.CylinderGeometry(0.1, 0.07, 0.65, 6);
    const legMat = darkMat;
    const legOffsets = [
      { x: 0.55, z: 0.35, name: 'FL' },
      { x: 0.55, z: -0.35, name: 'FR' },
      { x: -0.55, z: 0.35, name: 'BL' },
      { x: -0.55, z: -0.35, name: 'BR' }
    ];

    legOffsets.forEach(pos => {
      const legPivot = new THREE.Group();
      legPivot.position.set(pos.x, 0.5, pos.z);
      const legMesh = new THREE.Mesh(legGeo, legMat);
      legMesh.position.y = -0.28;
      
      // Paw
      const pawGeo = new THREE.BoxGeometry(0.2, 0.1, 0.18);
      const paw = new THREE.Mesh(pawGeo, goldMat);
      paw.position.set(0.05, -0.55, 0);
      legPivot.add(legMesh, paw);

      this.mesh.add(legPivot);
      this.legPairs.push(legPivot);
    });
  }

  // --- MODEL 2: HYPER HOVERBIKE ---
  buildHyperBike() {
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x111122,
      roughness: 0.2,
      metalness: 0.9
    });
    const glowRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true
    });

    // Frame
    const frameGeo = new THREE.BoxGeometry(1.8, 0.45, 0.6);
    const frame = new THREE.Mesh(frameGeo, darkMetal);
    frame.position.set(0, 0.6, 0);
    this.mesh.add(frame);

    // Front Fairing & Windshield
    const frontGeo = new THREE.ConeGeometry(0.4, 0.9, 5);
    frontGeo.rotateZ(-Math.PI / 2);
    const front = new THREE.Mesh(frontGeo, darkMetal);
    front.position.set(0.9, 0.7, 0);
    this.mesh.add(front);

    const shieldGeo = new THREE.BoxGeometry(0.4, 0.35, 0.35);
    shieldGeo.rotateZ(-0.4);
    const windshield = new THREE.Mesh(shieldGeo, neonCyan);
    windshield.position.set(0.65, 0.95, 0);
    this.mesh.add(windshield);

    // Neon Hover Turbines (Front & Back)
    const turbineGeo = new THREE.TorusGeometry(0.38, 0.09, 8, 24);
    turbineGeo.rotateY(Math.PI / 2);
    const turbineF = new THREE.Mesh(turbineGeo, glowRingMat);
    turbineF.position.set(0.8, 0.35, 0);
    const turbineB = new THREE.Mesh(turbineGeo, glowRingMat);
    turbineB.position.set(-0.8, 0.35, 0);
    this.mesh.add(turbineF, turbineB);
    this.specialParts.push(turbineF, turbineB);

    // Thruster exhaust at rear
    const exhaustGeo = new THREE.CylinderGeometry(0.15, 0.22, 0.3, 8);
    exhaustGeo.rotateZ(Math.PI / 2);
    const exhaustMat = new THREE.MeshBasicMaterial({ color: 0xff0077 });
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.position.set(-0.95, 0.6, 0);
    this.mesh.add(exhaust);
    this.thruster = exhaust;
  }

  // --- MODEL 3: CANDY WYVERN ---
  buildCandyWyvern() {
    const pinkMat = new THREE.MeshStandardMaterial({
      color: 0xff69b4,
      roughness: 0.4
    });
    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.3
    });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Round plump body
    const bodyGeo = new THREE.SphereGeometry(0.65, 12, 10);
    bodyGeo.scale(1.4, 1.0, 0.9);
    const body = new THREE.Mesh(bodyGeo, pinkMat);
    body.position.set(0, 0.65, 0);
    this.mesh.add(body);

    // Cute Dragon Head
    const headGeo = new THREE.SphereGeometry(0.42, 10, 10);
    const head = new THREE.Mesh(headGeo, pinkMat);
    head.position.set(0.85, 0.9, 0);

    // Tiny golden horns
    const hornGeo = new THREE.ConeGeometry(0.08, 0.28, 5);
    hornGeo.rotateZ(-0.3);
    const hornL = new THREE.Mesh(hornGeo, yellowMat);
    hornL.position.set(0, 0.35, 0.18);
    const hornR = new THREE.Mesh(hornGeo, yellowMat);
    hornR.position.set(0, 0.35, -0.18);
    head.add(hornL, hornR);

    // Big shiny eyes
    const eyeGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, whiteMat);
    eyeL.position.set(0.25, 0.1, 0.25);
    const eyeR = new THREE.Mesh(eyeGeo, whiteMat);
    eyeR.position.set(0.25, 0.1, -0.25);
    head.add(eyeL, eyeR);

    this.mesh.add(head);
    this.specialParts.push(head);

    // Flapping Wings
    const wingGeo = new THREE.BoxGeometry(0.7, 0.05, 0.8);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xffe066 });
    
    const wingL = new THREE.Group();
    wingL.position.set(0.1, 0.95, 0.45);
    const wingMeshL = new THREE.Mesh(wingGeo, wingMat);
    wingMeshL.position.set(0, 0, 0.35);
    wingL.add(wingMeshL);

    const wingR = new THREE.Group();
    wingR.position.set(0.1, 0.95, -0.45);
    const wingMeshR = new THREE.Mesh(wingGeo, wingMat);
    wingMeshR.position.set(0, 0, -0.35);
    wingR.add(wingMeshR);

    this.mesh.add(wingL, wingR);
    this.wings = [wingL, wingR];

    // Tail with star tip
    const tailGroup = new THREE.Group();
    tailGroup.position.set(-0.7, 0.6, 0);
    const tailStarGeo = new THREE.TetrahedronGeometry(0.2);
    const starTip = new THREE.Mesh(tailStarGeo, yellowMat);
    starTip.position.set(-0.4, 0.1, 0);
    tailGroup.add(starTip);
    this.mesh.add(tailGroup);
    this.tail = tailGroup;
  }

  // --- ANIMATION UPDATE ---
  update(dt, speed, isGrounded, isSliding) {
    if (this.type === MOUNT_TYPES.NONE) return;
    this.animTime += dt * (speed * 0.4 + 4);

    if (this.type === MOUNT_TYPES.PANTHER) {
      if (isGrounded) {
        // Gallop cycle
        const sinT = Math.sin(this.animTime);
        const cosT = Math.cos(this.animTime);
        if (this.legPairs.length === 4) {
          this.legPairs[0].rotation.z = sinT * 0.7;  // FL
          this.legPairs[1].rotation.z = -sinT * 0.7; // FR
          this.legPairs[2].rotation.z = -cosT * 0.7; // BL
          this.legPairs[3].rotation.z = cosT * 0.7;  // BR
        }
        if (this.tail) {
          this.tail.rotation.z = Math.sin(this.animTime * 1.5) * 0.2;
        }
      } else {
        // Airborne leap pose
        if (this.legPairs.length === 4) {
          this.legPairs[0].rotation.z = 0.6;
          this.legPairs[1].rotation.z = 0.6;
          this.legPairs[2].rotation.z = -0.7;
          this.legPairs[3].rotation.z = -0.7;
        }
      }
    } else if (this.type === MOUNT_TYPES.BIKE) {
      // Hover bobbing & tilt
      const hoverY = Math.sin(this.animTime * 1.5) * 0.08;
      this.mesh.position.y = hoverY;
      this.mesh.rotation.z = isSliding ? -0.2 : Math.sin(this.animTime) * 0.04;
      
      // Spin turbine rings
      this.specialParts.forEach(tp => {
        tp.rotation.x += dt * 15;
      });
      if (this.thruster) {
        const pulse = 0.8 + Math.sin(this.animTime * 10) * 0.3;
        this.thruster.scale.set(pulse, pulse, pulse);
      }
    } else if (this.type === MOUNT_TYPES.WYVERN) {
      // Flapping wings
      if (this.wings) {
        const flap = Math.sin(this.animTime * 2.5) * 0.6;
        this.wings[0].rotation.x = flap;
        this.wings[1].rotation.x = -flap;
      }
      // Floating bobbing
      this.mesh.position.y = Math.sin(this.animTime * 1.2) * 0.1;
      if (this.tail) {
        this.tail.rotation.y = Math.sin(this.animTime) * 0.3;
      }
    }
  }

  // Perks
  getMaxJumps() {
    return this.type === MOUNT_TYPES.PANTHER ? 3 : 2;
  }

  getScoreMultiplier() {
    return this.type === MOUNT_TYPES.PANTHER ? 1.25 : 1.0;
  }

  getCoinMultiplier() {
    return this.type === MOUNT_TYPES.WYVERN ? 1.3 : 1.0;
  }

  hasSlideRam() {
    return this.type === MOUNT_TYPES.BIKE;
  }
}
