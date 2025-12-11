// Adventure command registration for the terminal router.
import adventure from '../engine/core.js';

if (typeof window !== 'undefined') {
  window.darknetAdventure = adventure;
}

function ensureGameRegistered() {
  if (typeof registerGame === 'function') {
    registerGame('adventure', {
      id: 'adventure',
      title: 'NRW Noir Adventure',
      start: adventure.start,
      continue: adventure.continue,
      reset: adventure.reset,
      help: adventure.help,
      handleInput: adventure.handleInput
    });
  }
}

function printCommandHelp() {
  printLines([
    'Adventure Befehle:',
    'adv start [name]    - Neues Abenteuer starten',
    'adv continue [name] - Letzten Spielstand laden',
    'adv reset [name]    - Spielstand zurücksetzen',
    'adv exit            - Adventure beenden',
    'adv help            - Diese Hilfe',
    'Während des Adventures werden Eingaben direkt interpretiert.'
  ]);
}

async function handleAdvCommand(args = []) {
  ensureGameRegistered();
  const sub = (args[0] || '').toLowerCase();
  const adventureId = args[1];
  switch (sub) {
    case 'start':
      await adventure.start(adventureId);
      break;
    case 'continue':
      await adventure.continue(adventureId);
      break;
    case 'reset':
      await adventure.reset(adventureId);
      break;
    case 'exit':
    case 'quit':
      adventure.exit();
      break;
    case 'help':
    default:
      printCommandHelp();
  }
}

export function register(router) {
  ensureGameRegistered();
  if (router && typeof router.registerCommand === 'function') {
    router.registerCommand('adv', handleAdvCommand);
  } else if (typeof window !== 'undefined' && window.registerCommand) {
    window.registerCommand('adv', handleAdvCommand);
  }
}

// Auto-register when loaded in browser context with a global router.
if (typeof window !== 'undefined' && window.commandRouter) {
  register(window.commandRouter);
}

export default handleAdvCommand;
