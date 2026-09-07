import * as THREE from 'three';
import { sound } from './Sound.js';

export class LevelManager {
    constructor(scene) {
        this.scene = scene;
        this.objects = [];
        this.distance = 0;
        
        // Materials
        this.floorMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
        this.obstacleMat = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        this.coinMat = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0xaa5500 });
        this.enemyMat = new THREE.MeshPhongMaterial({ color: 0xff5500 });
        this.rewardFloorMat = new THREE.MeshPhongMaterial({ color: 0x440044, emissive: 0x220022 });
        this.crossingFloorMat = new THREE.MeshPhongMaterial({ color: 0x002244, emissive: 0x001122 });

        // Base floor
        this.floorBase = new THREE.Mesh(new THREE.BoxGeometry(100, 1, 10), this.floorMat);
        this.floorBase.position.set(40, -0.5, 0);
        this.floorBase.receiveShadow = true;
        this.scene.add(this.floorBase);
        
        this.spawnZ = 0;
        this.baseSpeed = 20;
        this.currentSpeed = this.baseSpeed;
        
        this.mode = 'normal'; // normal, super, crossing
        this.modeTimer = 0;
        
        this.reset();
    }

    reset() {
        this.objects.forEach(obj => this.scene.remove(obj.mesh));
        this.objects = [];
        this.distance = 0;
        this.currentSpeed = this.baseSpeed;
        this.mode = 'normal';
        this.floorBase.material = this.floorMat;
        this.spawnNextChunk(10);
    }

    setMode(newMode) {
        if (this.mode === newMode) return;
        this.mode = newMode;
        sound.modeChange();
        
        if (this.mode === 'super') {
            this.modeTimer = 10; // 10 seconds of super reward
            this.floorBase.material = this.rewardFloorMat;
        } else if (this.mode === 'crossing') {
            this.modeTimer = 10;
            this.floorBase.material = this.crossingFloorMat;
            this.currentSpeed = this.baseSpeed * 2.5; // Extreme speed
        } else {
            this.floorBase.material = this.floorMat;
        }
    }

    update(dt, player) {
        // Increase speed slightly over time in normal mode
        if (this.mode === 'normal') {
            this.currentSpeed = this.baseSpeed + (this.distance / 1000);
        }

        const moveDist = this.currentSpeed * dt * (player.isDashing ? 2 : 1);
        this.distance += moveDist;
        
        // Update mode timer
        if (this.mode !== 'normal') {
            this.modeTimer -= dt;
            if (this.modeTimer <= 0) {
                this.setMode('normal');
            }
        }

        // Scroll floor texture or reposition base floor to simulate infinite runner
        this.floorBase.position.x = player.mesh.position.x + 30;

        // Move objects and check collisions
        let scoreToAdd = 0;
        let coinsToAdd = 0;
        
        const pb = player.getBounds();
        
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            obj.mesh.position.x -= moveDist;
            
            // Magnet effect for coins
            if (obj.type === 'coin' && player.magnetActive) {
                const dx = player.mesh.position.x - obj.mesh.position.x;
                const dy = player.mesh.position.y - obj.mesh.position.y;
                const distSq = dx*dx + dy*dy;
                if (distSq < 100) {
                    obj.mesh.position.x += dx * dt * 5;
                    obj.mesh.position.y += dy * dt * 5;
                }
            }
            
            // Animations
            if (obj.type === 'coin') obj.mesh.rotation.y += dt * 3;
            if (obj.type === 'enemy') {
                obj.mesh.position.y = 0.5 + Math.abs(Math.sin(Date.now() * 0.005)) * 0.5;
            }

            // AABB Collision
            const ob = this.getObjBounds(obj);
            if (this.checkCollision(pb, ob)) {
                if (obj.type === 'coin') {
                    this.scene.remove(obj.mesh);
                    this.objects.splice(i, 1);
                    coinsToAdd++;
                    scoreToAdd += (this.mode === 'super' ? 50 : 10);
                    sound.coin();
                    continue;
                } 
                else if (obj.type === 'enemy' && player.velocity.y < 0 && pb.minY > ob.maxY - 0.5) {
                    // Stomp enemy
                    this.scene.remove(obj.mesh);
                    this.objects.splice(i, 1);
                    player.stompBounce();
                    scoreToAdd += 100;
                    continue;
                }
                else if (obj.type === 'obstacle' || obj.type === 'enemy') {
                    if (player.hit()) {
                        // Game over triggered in Player
                    } else {
                        // Shield or dash broke the obstacle
                        this.scene.remove(obj.mesh);
                        this.objects.splice(i, 1);
                    }
                    continue;
                }
            }

            // Remove off-screen objects
            if (obj.mesh.position.x < player.mesh.position.x - 10) {
                this.scene.remove(obj.mesh);
                this.objects.splice(i, 1);
            }
        }

        // Spawn new chunks
        const lastObj = this.objects[this.objects.length - 1];
        let maxSpawnX = lastObj ? lastObj.mesh.position.x : 0;
        if (maxSpawnX < player.mesh.position.x + 80) {
            this.spawnNextChunk(maxSpawnX + 20);
        }

        return { score: scoreToAdd, coins: coinsToAdd };
    }

    spawnNextChunk(startX) {
        if (this.mode === 'super') {
            this.spawnSuperCoinArray(startX);
        } else if (this.mode === 'crossing') {
            this.spawnCrossingRings(startX);
        } else {
            this.spawnNormalChunk(startX);
        }
    }

    spawnNormalChunk(x) {
        // Randomly choose a pattern
        const rand = Math.random();
        if (rand < 0.3) {
            // High jump obstacle
            this.spawnObstacle(x, 1, 2);
            this.spawnCoinCurve(x - 2, 4);
        } else if (rand < 0.6) {
            // Duck obstacle
            this.spawnObstacle(x, 1.5, 3, 0, 1.5); // Floating block
            this.spawnCoin(x, 0.5);
        } else if (rand < 0.8) {
            // Enemy
            this.spawnEnemy(x);
            this.spawnCoin(x, 3);
        } else {
            // Coins only
            this.spawnCoinLine(x, 3);
        }
    }

    spawnSuperCoinArray(x) {
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 3; j++) {
                this.spawnCoin(x + i * 2, 1 + j * 1.5);
            }
        }
    }

    spawnCrossingRings(x) {
        // Just sparse coins in high speed
        this.spawnCoin(x, 1.5);
        this.spawnCoin(x + 5, 2.5);
        this.spawnCoin(x + 10, 1.5);
    }

    spawnObstacle(x, w, h, z = 0, yOffset = 0) {
        const geo = new THREE.BoxGeometry(w, h, 1);
        const mesh = new THREE.Mesh(geo, this.obstacleMat);
        mesh.position.set(x, h/2 + yOffset, z);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.objects.push({ type: 'obstacle', mesh, w, h, yOffset });
    }

    spawnEnemy(x) {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mesh = new THREE.Mesh(geo, this.enemyMat);
        mesh.position.set(x, 0.5, 0);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.objects.push({ type: 'enemy', mesh, w: 1, h: 1, yOffset: 0 });
    }

    spawnCoin(x, y) {
        const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
        const mesh = new THREE.Mesh(geo, this.coinMat);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(x, y, 0);
        this.scene.add(mesh);
        this.objects.push({ type: 'coin', mesh, w: 0.8, h: 0.8, yOffset: y - 0.4 });
    }

    spawnCoinLine(x, count) {
        for (let i = 0; i < count; i++) {
            this.spawnCoin(x + i * 1.5, 1);
        }
    }

    spawnCoinCurve(x, count) {
        for (let i = 0; i < count; i++) {
            const y = 1 + Math.sin((i / (count-1)) * Math.PI) * 2;
            this.spawnCoin(x + i * 2, y);
        }
    }

    getObjBounds(obj) {
        const hx = obj.w / 2;
        const hy = obj.h / 2;
        const hz = 0.5; // Fixed depth
        return {
            minX: obj.mesh.position.x - hx, maxX: obj.mesh.position.x + hx,
            minY: obj.mesh.position.y - hy, maxY: obj.mesh.position.y + hy,
            minZ: obj.mesh.position.z - hz, maxZ: obj.mesh.position.z + hz,
        };
    }

    checkCollision(a, b) {
        return (a.minX <= b.maxX && a.maxX >= b.minX) &&
               (a.minY <= b.maxY && a.maxY >= b.minY) &&
               (a.minZ <= b.maxZ && a.maxZ >= b.minZ);
    }
}
