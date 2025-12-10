// ---------------------------------------------------------
// TERMINAL – TAB-Autocomplete & Command Handler
// ---------------------------------------------------------

// ---------------------------------------------------------
// Globale Registry für externe Befehle (z. B. Adventure)
// ---------------------------------------------------------
if (typeof window !== "undefined") {
  window.EXT_COMMANDS = window.EXT_COMMANDS || {};

  window.registerCommand = function(name, handler) {
    if (typeof name !== "string" || !name.trim()) return;
    if (typeof handler !== "function") return;
    window.EXT_COMMANDS[name] = handler;
  };

  // Optionaler Router für Module, die ein Router-Objekt erwarten
  window.commandRouter = window.commandRouter || {
    registerCommand: (name, handler) => window.registerCommand(name, handler)
  };
}

// TAB-Autocomplete
function tabComplete() {
  const value = inputEl.value;
  const caretPos = inputEl.selectionStart;

  const beforeCursor = value.slice(0, caretPos);
  const parts = beforeCursor.trimStart().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return;

  const base = parts[0];
  const isPathCommand = ["ls", "cd", "cat", "tree"].includes(base);

  // 1) Command-Autocomplete
  if (!isPathCommand || parts.length === 1) {
    const currentToken = parts[0];
    const allCommands = Array.from(
      new Set([...BUILTIN_COMMANDS, ...Object.keys(FILE_INDEX)])
    );

    const candidates = allCommands.filter(cmd =>
      cmd.startsWith(currentToken)
    );

    if (candidates.length === 1) {
      inputEl.value = candidates[0] + " ";
      inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
    } else if (candidates.length > 1) {
      printLines(["Mögliche Befehle:", ...candidates, ""], "dim");
    }
    return;
  }

  // 2) Pfad-Autocomplete
  const firstSpaceIndex = value.indexOf(" ");
  if (firstSpaceIndex === -1) return;

  const rawArg = value.slice(firstSpaceIndex + 1).trim();
  const baseText = value.slice(0, firstSpaceIndex).trim();

  if (!rawArg) {
    const { dirs, files } = getChildrenOfDir(CURRENT_DIR);
    const names = [
      ...dirs.map(d => d + "/"),
      ...files.map(f => f.name)
    ];
    if (names.length) {
      printLines(["Mögliche Einträge:", ...names, ""], "dim");
    }
    return;
  }

  const lastSlashIndex = rawArg.lastIndexOf("/");
  let dirPart = "";
  let namePrefix = rawArg;

  if (lastSlashIndex !== -1) {
    dirPart = rawArg.slice(0, lastSlashIndex);
    namePrefix = rawArg.slice(lastSlashIndex + 1);
  }

  const targetDirSegs = normalizePathSegments(CURRENT_DIR, dirPart || ".");
  if (!dirExists(targetDirSegs)) {
    printLines([`Kein Verzeichnis: ${segmentsToPath(targetDirSegs)}`, ""], "error");
    return;
  }

  const { dirs, files } = getChildrenOfDir(targetDirSegs);
  const allNames = [
    ...dirs.map(d => d + "/"),
    ...files.map(f => f.name)
  ];

  const candidates = allNames.filter(name => name.startsWith(namePrefix));

  if (candidates.length === 1) {
    const completedName = candidates[0];
    const newArg = dirPart
      ? dirPart + "/" + completedName
      : completedName;

    const newValue = baseText + " " + newArg;
    inputEl.value = newValue;
    inputEl.selectionStart = inputEl.selectionEnd = newValue.length;
  } else if (candidates.length > 1) {
    printLines(["Mögliche Einträge:", ...candidates, ""], "dim");
  }
}

// Command Handler
async function handleCommand(raw) {
  // Eingabe aufbereiten
  const cmd = (raw || "").trim();
  if (!cmd) return;

  // -----------------------------------------
  // Login-Mode: erste Eingabe = Benutzername
  // -----------------------------------------
  if (LOGIN_MODE) {
    const name = cmd;

    if (name.length < 3) {
      printLines(
        ["Bitte mindestens 3 Zeichen als Benutzernamen wählen.", ""],
        "error"
      );
      return;
    }
    if (name.length > 24) {
      printLines(
        ["Der Name ist etwas lang. Maximal 24 Zeichen bitte.", ""],
        "error"
      );
      return;
    }

    setUserName(name);
    LOGIN_MODE = false;

    printLines(
      [`Benutzer '${getUserName()}' im Darknetz registriert.`, ""],
      "success"
    );

    // Begrüßung nach erfolgreichem Login
    if (typeof printWelcome === "function") {
      printWelcome();
    }

    return;
  }

  // -----------------------------------------
  // Normaler Prompt
  // -----------------------------------------
  printLines(
    [`${getUserName()}@darknet-nrw-noir:${segmentsToPath(CURRENT_DIR)}$ ${cmd}`],
    "prompt"
  );

  const parts = cmd.split(" ").filter(Boolean);
  const base  = parts[0];
  const args  = parts.slice(1);
  const arg   = args[0] || "";

  // ---------------------------------------------------------
  // Externe Commands (z. B. Adventure)
  // ---------------------------------------------------------
  if (
    typeof window !== "undefined" &&
    window.EXT_COMMANDS &&
    window.EXT_COMMANDS[base]
  ) {
    const handler = window.EXT_COMMANDS[base];
    await handler(args);
    return;
  }

  // ---------------------------------------------------------
  // TicTacToe: Schnellzug (nur eine Zahl 1–9 eingeben)
  // ---------------------------------------------------------
  if (typeof TTT_ACTIVE !== "undefined" &&
      TTT_ACTIVE &&
      parts.length === 1 &&
      /^[1-9]$/.test(base) &&
      typeof tttHandleMove === "function") {
    await tttHandleMove(base);
    return;
  }

  // ---------------------------------------------------------
  // Game Hub
  // ---------------------------------------------------------
  if (base === "game" || base === "games") {
    if (typeof handleGameHubCommand === "function") {
      await handleGameHubCommand(parts.slice(1));
    } else {
      printLines([
        "Game-Hub ist noch nicht geladen.",
        ""
      ], "error");
    }
    return;
  }

  // ---------------------------------------------------------
  // Direktes TicTacToe-Command
  // ---------------------------------------------------------
  if (base === "ttt" && typeof tttCommand === "function") {
    await tttCommand(parts.slice(1));
    return;
  }

  // ---------------------------------------------------------
  // Built-in Commands
  // ---------------------------------------------------------
  if (base === "help") {
    printLines([
      "Verfügbare Befehle:",
      "  help              - diese Übersicht",
      "  clear             - Terminal leeren",
      "  list              - Übersicht Einträge",
      "  ls [pfad]         - Verzeichnisinhalt anzeigen",
      "  cd [pfad]         - Verzeichnis wechseln",
      "  pwd               - aktuelles Verzeichnis zeigen",
      "  cat <pfad>        - Datei anzeigen",
      "  tree [pfad]       - Verzeichnisbaum anzeigen",
      "  scan              - Schattennetz scannen",
      "  game / games      - Game Hub",
      "",
      "JSON-basierte Befehle (direkte Commands):",
      ...Object.keys(FILE_INDEX).map(k => "  " + k),
      ""
    ]);
    return;
  }

  if (base === "clear") {
    outputEl.innerHTML = "";
    return;
  }

  if (base === "list") {
    printLines([
      "VERFÜGBARE DARKNETZ-EINTRÄGE:",
      "---------------------------------------------",
      ...Object.values(FILE_INDEX).map(
        f => `${f.command}  ->  ${f.path}`
      ),
      ""
    ]);
    return;
  }

  if (base === "pwd") {
    printLines([segmentsToPath(CURRENT_DIR), ""]);
    return;
  }

  if (base === "ls") {
    const targetSegs = normalizePathSegments(CURRENT_DIR, arg);
    const targetPath = targetSegs.join("/");

    if (!dirExists(targetSegs)) {
      if (FS_NODES[targetPath]) {
        printLines([
          `${segmentsToPath(targetSegs)} ist eine Datei.`,
          ""
        ], "error");
      } else {
        printLines([
          `ls: Verzeichnis nicht gefunden: ${segmentsToPath(targetSegs)}`,
          ""
        ], "error");
      }
      return;
    }

    const { dirs, files } = getChildrenOfDir(targetSegs);
    const out = [];

    dirs.sort().forEach(d => out.push(d + "/"));
    files
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(f => out.push(f.name));

    printLines(out.length ? out.concat([""]) : ["<leer>", ""]);
    return;
  }

  if (base === "cd") {
    const targetSegs = normalizePathSegments(CURRENT_DIR, arg || "/");
    const targetPath = targetSegs.join("/");

    if (FS_NODES[targetPath]) {
      printLines([
        `cd: '${segmentsToPath(targetSegs)}' ist eine Datei.`,
        ""
      ], "error");
      return;
    }

    if (!dirExists(targetSegs)) {
      printLines([
        `cd: Verzeichnis nicht gefunden: ${segmentsToPath(targetSegs)}`,
        ""
      ], "error");
      return;
    }

    CURRENT_DIR = targetSegs;
    return;
  }

  if (base === "cat") {
    if (!arg) {
      printLines(["cat: Bitte eine Datei angeben.", ""], "error");
      return;
    }
    const targetSegs = normalizePathSegments(CURRENT_DIR, arg);
    const targetPath = targetSegs.join("/");
    const meta = FS_NODES[targetPath];

    if (!meta) {
      printLines([
        `cat: Datei nicht gefunden: ${segmentsToPath(targetSegs)}`,
        ""
      ], "error");
      return;
    }

    const lines = await loadDocumentByMeta(meta);
    printLines(lines);
    return;
  }

  if (base === "tree") {
    const targetSegs = normalizePathSegments(CURRENT_DIR, arg || ".");
    if (!dirExists(targetSegs)) {
      printLines([
        `tree: Verzeichnis nicht gefunden: ${segmentsToPath(targetSegs)}`,
        ""
      ], "error");
      return;
    }
    const lines = buildTreeLines(targetSegs);
    printLines(lines);
    return;
  }

  if (base === "scan") {
    await runScanCommand();
    return;
  }

  // ---------------------------------------------------------
  // JSON-basierte direkte Befehle
  // ---------------------------------------------------------
  if (FILE_INDEX[base]) {
    const lines = await loadDocumentByCommand(base);
    printLines(lines);
    return;
  }

  // ---------------------------------------------------------
  // Unbekannter Befehl
  // ---------------------------------------------------------
  printLines([
    `Unbekannter Befehl: '${cmd}'`,
    "Tippe 'help' für eine Liste der verfügbaren Befehle.",
    ""
  ], "error");
}
