import './styles.css';
import { Game } from './game/Game.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const game = new Game(canvas);

  // Setup Mount / Pet selection cards in Start Screen
  const mountCards = document.querySelectorAll('.select-mount');
  mountCards.forEach(card => {
    card.addEventListener('click', () => {
      mountCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const mount = card.dataset.mount;
      game.player.hasMount = (mount !== 'none');
      game.player.mountType = mount;
    });
  });

  const petCards = document.querySelectorAll('.select-pet');
  petCards.forEach(card => {
    card.addEventListener('click', () => {
      petCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const pet = card.dataset.pet;
      game.player.hasPet = (pet !== 'none');
      game.player.petType = pet;
    });
  });

  // Start game loop
  game.loop();
});
