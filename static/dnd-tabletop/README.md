# D&D Tabletop

A simple virtual tabletop for D&D sessions. Upload a map, place tokens, draw markers.

**Live:** https://milodowling.github.io/dnd-tabletop/

## Features

- **Backdrop** - Upload PNG/JPEG maps as your battle grid
- **Icons/Tokens** - Drag PNG tokens onto the map, move and resize them
- **Drawing** - Freehand markers with 5 colors and 3 thickness options
- **Straight Lines** - Hold Shift while drawing
- **Erase** - Remove drawings
- **Touch Support** - Works on iPad with Apple Pencil
- **Auto-save** - State persists in localStorage

## Usage

1. Upload a backdrop map
2. Add icon PNGs to your library
3. Drag icons from sidebar onto the map
4. Hover over placed icons to resize (corners) or delete (X button)
5. Use Draw/Erase modes for annotations

## TODO

- [ ] Whitespace trim only removes absolute white - needs proper background detection for all colors
- [ ] Naming and organizing icons in the library
- [ ] Export/import config (save sessions to file)
- [ ] Undo/redo for drawings
- [ ] Grid overlay option
- [ ] Zoom and pan for large maps
- [ ] Multiple layers (tokens above/below drawings)
- [ ] Fog of war for DM use
- [ ] Shared sessions (multiplayer via WebRTC or server)
