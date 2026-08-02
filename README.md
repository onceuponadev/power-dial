# Power Dial

A GNOME Shell extension that provides a quick power menu with suspend, lock, restart, power off, hibernate, and logout options.

<img src="assets/power-dial-tiled-menu.png" alt="Power Dial Tiled Menu">

> Restart your system after enabling the extension for the keyboard shortcut to work properly.

## Usage

### Accessing Power Dial

**Two ways to open the menu:**

- **Keyboard Shortcut**: Press `Alt + F5` (or your custom shortcut)
- **Top Bar Icon**: Click the power icon in the GNOME top bar (if enabled)

> Both methods open the same power menu with your configured power options.

## Requirements

-   GNOME Shell 45 or later
-   Works on both X11 and Wayland

## Power Options

| Option | Description | Behavior |
|--------|-------------|----------|
| **Suspend** | Put system to sleep | Immediate action |
| **Lock** | Lock the screen | Immediate action |
| **Restart** | Reboot the system | Configurable confirmation |
| **Power Off** | Shutdown the system | Configurable confirmation |
| **Hibernate** | Save session to disk and power off | Requires system configuration |
| **Log Out** | End current user session | Configurable confirmation |

### Hibernate
Hibernate saves your session to disk and powers off completely. On next boot, your session is restored exactly as it was.

-   **Check Support**: Use the "Check" button in preferences to verify your system supports hibernation
-   **Enable**: Only available after the system check passes
-   Requires system-level swap configuration — see [HIBERNATE.md](HIBERNATE.md) for setup instructions

## Installation

Download and enable the extension from the GNOME Extensions website:

[Download Power Dial Extension](https://extensions.gnome.org/extension/8563/power-dial/)
