import * as THREE from 'three';
import { sound } from './Sound.js';

export class Player {
    constructor(scene) {
        this.scene = scene;
        
        // Player mesh
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshPhongMaterial({ color: 0x00ffff, emissive: 0x004444 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.position.set(0, 1, 0);
        this.scene.add(this.mesh);

        // Shield mesh
        const shieldGeo = new THREE.SphereGeometry(1.2, 16, 16);
        const shieldMat = new THREE.MeshPhongMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, wireframe: true });
        this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        this.shieldMesh.visible = false;
        this.mesh.add(this.shieldMesh);
        
        this.reset();
    }

    reset() {
        this.mesh.position.set(0, 1, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.gravity = -40;
        this.jumpForce = 15;
        this.isGrounded = false;
        this.jumpCount = 0;
        this.maxJumps = 2;
        this.isDucking = false;
        
        // Skills
        this.isDashing = false;
        this.dashTimer = 0;
        this.hasShield = false;
        this.magnetActive = false;
        this.magnetTimer = 0;
        
        this.isDead = false;
        this.mesh.scale.set(1, 1, 1);
        this.shieldMesh.visible = false;
    }

    update(dt) {
        if (this.isDead) return;

        // Apply gravity
        if (!this.isGrounded) {
            this.velocity.y += this.gravity * dt;
        }

        this.mesh.position.y += this.velocity.y * dt;

        // Floor collision
        if (this.mesh.position.y <= (this.isDucking ? 0.5 : 1)) {
            this.mesh.position.y = this.isDucking ? 0.5 : 1;
            this.velocity.y = 0;
            this.isGrounded = true;
            this.jumpCount = 0;
        } else {
            this.isGrounded = false;
        }

        // Skill timers
        if (this.isDashing) {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
                this.mesh.material.color.setHex(0x00ffff);
            }
        }
        
        if (this.magnetActive) {
            this.magnetTimer -= dt;
            if (this.magnetTimer <= 0) {
                this.magnetActive = false;
            }
        }
        
        // Shield visuals spin
        if (this.hasShield) {
            this.shieldMesh.rotation.y += 2 * dt;
            this.shieldMesh.rotation.z += 1 * dt;
        }
    }

    jump() {
        if (this.isDead || this.isDucking) return;
        
        if (this.jumpCount < this.maxJumps) {
            this.velocity.y = this.jumpForce;
            this.jumpCount++;
            this.isGrounded = false;
            
            if (this.jumpCount === 1) sound.jump();
            else sound.doubleJump();
        }
    }

    duck(isDucking) {
        if (this.isDead || !this.isGrounded) return;
        
        this.isDucking = isDucking;
        if (isDucking) {
            this.mesh.scale.set(1, 0.5, 1);
            this.mesh.position.y = 0.5;
        } else {
            this.mesh.scale.set(1, 1, 1);
            this.mesh.position.y = 1;
        }
    }

    stompBounce() {
        this.velocity.y = this.jumpForce * 0.8;
        this.jumpCount = 1; // allow one more jump after stomp
        this.isGrounded = false;
        sound.stomp();
    }

    activateDash() {
        if (this.isDashing) return;
        this.isDashing = true;
        this.dashTimer = 2.0;
        this.mesh.material.color.setHex(0xff00ff);
        sound.dash();
    }

    activateShield() {
        if (this.hasShield) return;
        this.hasShield = true;
        this.shieldMesh.visible = true;
        sound.dash(); // reuse sound
    }
    
    activateMagnet() {
        this.magnetActive = true;
        this.magnetTimer = 5.0;
        sound.dash();
    }

    hit() {
        if (this.isDashing) return false; // Invincible
        if (this.hasShield) {
            this.hasShield = false;
            this.shieldMesh.visible = false;
            sound.shieldBreak();
            return false;
        }
        
        this.isDead = true;
        sound.hit();
        return true;
    }

    getBounds() {
        const hx = 0.5;
        const hy = this.isDucking ? 0.5 : 1.0;
        const hz = 0.5;
        return {
            minX: this.mesh.position.x - hx, maxX: this.mesh.position.x + hx,
            minY: this.mesh.position.y - hy, maxY: this.mesh.position.y + hy,
            minZ: this.mesh.position.z - hz, maxZ: this.mesh.position.z + hz,
        };
    }
}
