// Global command registry for the Darknetz terminal to allow external modules to
// register their own commands (e.g., the adventure module).
(function () {
  if (typeof window === 'undefined') return;

  // Shared registry for external commands.
  window.EXT_COMMANDS = window.EXT_COMMANDS || {};

  // Public API for modules to add commands.
  window.registerCommand = window.registerCommand || function registerCommand(name, handler) {
    if (typeof name !== 'string' || !name.trim()) return;
    if (typeof handler !== 'function') return;
    window.EXT_COMMANDS[name.trim()] = handler;
  };

  // Provide a lightweight router interface for modules that expect it.
  window.commandRouter = window.commandRouter || {
    registerCommand: window.registerCommand
  };

  // Wrap the existing handleCommand to dispatch external commands first.
  const originalHandleCommand = window.handleCommand;

  // Avoid double-wrapping if this file is included multiple times.
  if (originalHandleCommand && originalHandleCommand.__supportsExternalCommands) {
    return;
  }

  async function handleCommandWithExternal(raw) {
    if (typeof raw !== 'string') {
      if (typeof originalHandleCommand === 'function') {
        return originalHandleCommand(raw);
      }
      return;
    }

    const cmd = raw.trim();
    if (!cmd) return;

    const parts = cmd.split(' ').filter(Boolean);
    const base = parts[0];
    const args = parts.slice(1);

    // Dispatch to registered external commands before built-ins.
    if (window.EXT_COMMANDS && typeof window.EXT_COMMANDS[base] === 'function') {
      const handler = window.EXT_COMMANDS[base];
      return await handler(args);
    }

    // Fall back to the existing handler so built-ins keep working.
    if (typeof originalHandleCommand === 'function') {
      return await originalHandleCommand(raw);
    }
  }

  handleCommandWithExternal.__supportsExternalCommands = true;
  window.handleCommand = handleCommandWithExternal;
})();
