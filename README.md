# NRW Noir Adventure Engine

**Version:** 1.0.0

Die NRW Noir Adventure Engine ist eine browserbasierte Textadventure-Plattform mit eingebautem Terminal-Interface und einem visuellen Adventure Builder. Engine und Builder sind darauf ausgelegt, komplette Adventures als JSON-Daten zu verwalten, Events auszuführen und die Welten direkt im Browser zu testen.

## Features der Adventure Engine
- **Event-gesteuerte Story-Logik:** JSON-basierte Events für Erzählertexte, ASCII-Anzeigen, Flag-Logik, Inventaränderungen, Raumwechsel und Kämpfe bilden den Kern des Adventuresystems.
- **Umfangreiche Eventtypen:** Message-, ASCII-, Flag-, Inventar-, Exit- und Teleport-Events sowie Kampf-Trigger können in Reihenfolge kombiniert werden.
- **Terminal-Interface:** Eingebautes Terminal mit Autocomplete, Nutzer-Login, Dateisystem-Commands (z. B. `ls`, `cd`, `cat`) und erweiterbarer Befehlsregistry für adventurespezifische Commands.
- **Game Hub Integration:** Adventures können eigene Befehle registrieren und Minispiele wie Tic-Tac-Toe im Terminal verfügbar machen.
- **ASCII-Art Unterstützung:** Adventure-Räume können ASCII-Dateien laden und darstellen, um Stimmungen oder Hinweise zu visualisieren.

## Features des Adventure Builders
- **Dashboard für Adventures:** Adventures auflisten, anlegen, bearbeiten, duplizieren und direkt aus dem Builder öffnen.
- **WYSIWYG-Welteditor:** Räume, Items, Objekte und NPCs erstellen oder bearbeiten, inklusive Karten-Navigation, ASCII-Vorschau und skalierbarer Raumkarte.
- **Dialog- und NPC-Tools:** NPC-Sammlungen automatisch bereitstellen, Dialogzustände initialisieren und Dialoge mit Karten-Visualisierung bearbeiten.
- **Event-Block-Editor:** Blockly-basierter Editor zum visuellen Erstellen der Eventketten, die in den Adventures ausgeführt werden.
- **Adventure-Tests im Browser:** Aktuelles Adventure mit einem Klick im Terminal-Modus öffnen, um Änderungen direkt zu prüfen.
- **ASCII-Upload:** ASCII-Dateien hochladen und im Builder verwalten, damit Räume sofort passende Artworks erhalten.

## Projektstruktur
- `builder.html` – Oberfläche des Adventure Builders
- `js/builder/` – Builder-Logik (API-Client, Event-Editor, Dialog-Tools, Layout)
- `js/terminal.js` – Terminal-Interface mit Befehlsverarbeitung
- `doc/` – Dokumentation, u. a. Event-Cheatsheet
- `games/` – Beispiel- oder Demo-Adventures

## Lizenz
Falls nicht anders angegeben, gelten die in diesem Repository hinterlegten Lizenzbedingungen.
