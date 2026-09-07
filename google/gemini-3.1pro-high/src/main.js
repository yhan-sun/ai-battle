import * as THREE from 'three';
import { Player } from './Player.js';
import { LevelManager } from './LevelManager.js';
import { sound } from './Sound.js';

class Game {
    constructor() {
        this.score = 0;
        this.coins = 0;
        this.highScore = parseInt(localStorage.getItem('nr3d_highscore') || '0');
        this.state = 'START'; // START, PLAYING, PAUSED, GAMEOVER
        
        this.superModeCost = 20;
        this.crossingModeCost = 40;
        this.reviveCost = 1000;

        this.initThree();
        this.initUI();
        this.initInputs();
        
        this.player = new Player(this.scene);
        this.level = new LevelManager(this.scene);

        this.lastTime = performance.now();
        this.animate();
    }

    initThree() {
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.02);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambient = new THREE.AmbientLight(0x404040);
        this.scene.add(ambient);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 1);
        this.dirLight.position.set(10, 20, 10);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.camera.left = -20;
        this.dirLight.shadow.camera.right = 20;
        this.dirLight.shadow.camera.top = 20;
        this.dirLight.shadow.camera.bottom = -20;
        this.scene.add(this.dirLight);

        // Particles
        this.initParticles();

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    initParticles() {
        const pGeo = new THREE.BufferGeometry();
        const pCount = 500;
        const pArr = new Float32Array(pCount * 3);
        for(let i=0; i<pCount*3; i++) {
            pArr[i] = (Math.random() - 0.5) * 100;
        }
        pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
        const pMat = new THREE.PointsMaterial({ color: 0x00ffff, size: 0.2, transparent: true, opacity: 0.5 });
        this.particles = new THREE.Points(pGeo, pMat);
        this.scene.add(this.particles);
    }

    initUI() {
        this.ui = {
            hudScore: document.getElementById('hud-score'),
            hudCoins: document.getElementById('hud-coins'),
            hudDist: document.getElementById('hud-distance'),
            startScreen: document.getElementById('start-screen'),
            pauseScreen: document.getElementById('pause-screen'),
            gameOverScreen: document.getElementById('game-over-screen'),
            endScore: document.getElementById('end-score'),
            endDist: document.getElementById('end-distance'),
            highScoreElem: document.getElementById('high-score'),
            modeText: document.getElementById('mode-announcement'),
            
            btnDash: document.getElementById('btn-dash'),
            btnShield: document.getElementById('btn-shield'),
            btnMagnet: document.getElementById('btn-magnet'),
            btnPause: document.getElementById('btn-pause')
        };

        document.getElementById('btn-start').onclick = () => this.startGame();
        document.getElementById('btn-resume').onclick = () => this.resumeGame();
        document.getElementById('btn-restart').onclick = () => this.startGame();
        document.getElementById('btn-revive').onclick = () => this.reviveGame();
        
        this.ui.btnDash.onclick = () => this.player.activateDash();
        this.ui.btnShield.onclick = () => this.player.activateShield();
        this.ui.btnMagnet.onclick = () => this.player.activateMagnet();
        this.ui.btnPause.onclick = () => this.togglePause();

        this.ui.highScoreElem.innerText = this.highScore;
    }

    initInputs() {
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'PLAYING') {
                if (e.code === 'Escape' && this.state === 'PAUSED') this.resumeGame();
                return;
            }

            switch(e.code) {
                case 'Space':
                case 'ArrowUp':
                    this.player.jump();
                    break;
                case 'ArrowDown':
                    this.player.duck(true);
                    break;
                case 'KeyD':
                    this.player.activateDash();
                    break;
                case 'KeyS':
                    this.player.activateShield();
                    break;
                case 'KeyM':
                    this.player.activateMagnet();
                    break;
                case 'Escape':
                    this.togglePause();
                    break;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'ArrowDown') {
                this.player.duck(false);
            }
        });
    }

    startGame() {
        sound.resume();
        this.score = 0;
        this.coins = 0;
        this.player.reset();
        this.level.reset();
        
        this.ui.startScreen.classList.add('hidden');
        this.ui.gameOverScreen.classList.add('hidden');
        this.state = 'PLAYING';
        this.lastTime = performance.now();
    }
    
    reviveGame() {
        if (this.score >= this.reviveCost) {
            this.score -= this.reviveCost;
            this.player.isDead = false;
            this.player.activateShield(); // Give iframe
            this.ui.gameOverScreen.classList.add('hidden');
            this.state = 'PLAYING';
            this.lastTime = performance.now();
        }
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.ui.pauseScreen.classList.remove('hidden');
        } else if (this.state === 'PAUSED') {
            this.resumeGame();
        }
    }

    resumeGame() {
        this.state = 'PLAYING';
        this.ui.pauseScreen.classList.add('hidden');
        this.lastTime = performance.now();
    }

    gameOver() {
        this.state = 'GAMEOVER';
        this.ui.endScore.innerText = Math.floor(this.score);
        this.ui.endDist.innerText = Math.floor(this.level.distance);
        
        if (this.score > this.highScore) {
            this.highScore = Math.floor(this.score);
            localStorage.setItem('nr3d_highscore', this.highScore);
            this.ui.highScoreElem.innerText = this.highScore;
        }

        const reviveBtn = document.getElementById('btn-revive');
        if (this.score >= this.reviveCost) {
            reviveBtn.style.display = 'inline-block';
        } else {
            reviveBtn.style.display = 'none';
        }
        
        this.ui.gameOverScreen.classList.remove('hidden');
    }

    triggerMode(modeName, text) {
        this.level.setMode(modeName);
        this.ui.modeText.innerText = text;
        this.ui.modeText.classList.add('show');
        setTimeout(() => this.ui.modeText.classList.remove('show'), 2000);
    }

    updateUI() {
        this.ui.hudScore.innerText = Math.floor(this.score);
        this.ui.hudCoins.innerText = this.coins;
        this.ui.hudDist.innerText = Math.floor(this.level.distance);
        
        this.ui.btnDash.className = `skill-btn ${this.player.isDashing ? 'cooldown' : ''}`;
        this.ui.btnShield.className = `skill-btn ${this.player.hasShield ? 'cooldown' : ''}`;
        this.ui.btnMagnet.className = `skill-btn ${this.player.magnetActive ? 'cooldown' : ''}`;
    }

    animate(time) {
        requestAnimationFrame((t) => this.animate(t));

        if (this.state !== 'PLAYING') return;

        const dt = Math.min((time - this.lastTime) / 1000, 0.1); // clamp dt
        this.lastTime = time;

        // Logic
        this.player.update(dt);
        const { score, coins } = this.level.update(dt, this.player);
        
        this.score += score + (this.level.currentSpeed * dt);
        const oldCoins = this.coins;
        this.coins += coins;
        
        // Mode Triggers
        if (this.coins > oldCoins) {
            if (this.coins % this.crossingModeCost === 0 && this.level.mode === 'normal') {
                this.triggerMode('crossing', 'CROSSING REWARD!');
            } else if (this.coins % this.superModeCost === 0 && this.level.mode === 'normal') {
                this.triggerMode('super', 'SUPER BONUS!');
            }
        }

        if (this.player.isDead) {
            this.gameOver();
        }

        // Camera follow
        const targetCamX = this.player.mesh.position.x - 5;
        const targetCamY = this.player.mesh.position.y + 3;
        
        // Camera shake on hit/dash
        let shake = 0;
        if (this.player.isDead) shake = 0.5;
        else if (this.player.isDashing) shake = 0.1;

        this.camera.position.x += (targetCamX - this.camera.position.x) * 0.1;
        this.camera.position.y += (targetCamY - this.camera.position.y) * 0.1 + (Math.random()-0.5)*shake;
        this.camera.position.z = 8 + (Math.random()-0.5)*shake;
        
        this.camera.lookAt(this.player.mesh.position.x + 5, 1, 0);

        // Directional light follow
        this.dirLight.position.x = this.player.mesh.position.x + 10;
        
        // Parallax particles
        this.particles.position.x = this.player.mesh.position.x;
        this.particles.rotation.y -= dt * 0.1;

        // Render & UI
        this.updateUI();
        this.renderer.render(this.scene, this.camera);
    }
}

// Start app
window.onload = () => {
    new Game();
};
