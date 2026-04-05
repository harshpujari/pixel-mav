# Pixel Mav

**Watch your Claude Code agents come to life as animated pixel art cats.**

Pixel Mav is a VS Code extension that connects to your Claude Code terminal sessions and represents each active agent as a charming pixel art cat. Whether they're typing, reading files, or waiting for your permission, your agents now have a visible (and adorable) presence in your workspace.

![Pixel Mav Banner](https://raw.githubusercontent.com/harshpujari/pixel-mav/main/banner.png) *(Note: Placeholder link)*

## Features

- **Real-time Agent Tracking**: Automatically detects Claude Code terminals and spawns a unique cat for each session.
- **Dynamic Behaviors**: Cats mimic your agent's activity:
  - **Typing**: The cat busily paws at its desk when the agent is writing code or running commands.
  - **Reading**: The cat looks focused when the agent is reading files or searching the web.
  - **Waiting**: The cat sits patiently (and sometimes blinks) when the agent is waiting for user input or permission.
- **Idle Personality**: When Claude is idle, cats exhibit natural behaviors like sleeping, grooming, stretching, or wandering around the office.
- **Social Interactions**: Cats might nap together, play, or give each other a friendly headbonk.
- **Customizable Office**: Use the built-in **Layout Editor** to design your own agent office. Place desks, plants, bookshelves, and cat beds.
- **Sub-agent Support**: When Claude spawns a sub-agent (using the `Task` tool), a smaller "child" cat appears to help.
- **Audio Feedback**: Delightful (and toggleable) sound effects for spawns, completions, and prompts.

## How to Use

1.  **Open the Panel**: Click the Pixel Mav icon in the Activity Bar or run the command `Pixel Mav: Show Panel`.
2.  **Start Claude**: Open a terminal and run `claude`. A cat will automatically spawn to represent that agent.
3.  **Interact**:
    - **Click a cat** to immediately focus its corresponding terminal.
    - **Right-click** in Editor Mode to erase or modify the layout.
4.  **Edit the Office**: Press `E` or click the "Layout" button to enter Editor Mode. You can paint floors, walls, and place furniture.

## Keyboard Shortcuts

- `F3`: Toggle Debug Overlay (FPS, entity counts).
- `F4`: Toggle Performance Stress Test (spawns 20 cats).
- `E`: Toggle Layout Editor.
- `Ctrl/Cmd + Z`: Undo (in Editor).
- `Ctrl/Cmd + Y`: Redo (in Editor).
- `R`: Rotate selected furniture.
- `T`: Toggle desk monitor on/off (in Editor).
- `Del / Backspace`: Delete selected furniture.

## Troubleshooting

- **No cat spawning?** Ensure your terminal is named "claude" (the default) and that you are using Claude Code. Pixel Mav looks for `.jsonl` transcript files in your project's `.claude/` directory.
- **Audio not playing?** Browser security policies require a user interaction (like a click) before audio can play. Click anywhere on the Pixel Mav canvas to enable sound.

## License

MIT
