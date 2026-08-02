import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import { ShortcutSettings } from "./preferences/shortcutSettings.js";
import { DisplaySettings } from "./preferences/displaySettings.js";
import { PowerOptions } from "./preferences/powerOptions.js";

export default class PowerDialPreferences extends ExtensionPreferences {
	fillPreferencesWindow(window) {
		const iconTheme = Gtk.IconTheme.get_for_display(window.get_display());
		iconTheme.add_search_path(`${this.path}/icons`);

		const page = new Adw.PreferencesPage({
			title: "General",
			icon_name: "preferences-system-symbolic",
		});
		window.add(page);

		const keyboardGroup = new Adw.PreferencesGroup({
			title: "Keyboard Shortcut",
			description: "Configure the keybinding to open Power Dial",
		});
		page.add(keyboardGroup);

		const displayGroup = new Adw.PreferencesGroup({
			title: "Display",
			description: "Customize how the power dial appears",
		});
		page.add(displayGroup);

		const powerGroup = new Adw.PreferencesGroup({
			title: "Power Options",
			description: "Configure confirmation behavior for power actions",
		});
		page.add(powerGroup);

		const hibernateGroup = new Adw.PreferencesGroup({
			title: "Hibernate",
			description: "Hibernate saves your session to disk and powers off completely. Requires system-level swap configuration.",
		});
		page.add(hibernateGroup);

		const settings = this.getSettings();

		const shortcutSettings = new ShortcutSettings(settings);
		const displaySettings = new DisplaySettings(settings);
		const powerOptions = new PowerOptions(settings);

		const shortcutRow = new Adw.ActionRow({
			title: "Power Dial Shortcut",
			subtitle: "Click to change the keyboard shortcut",
		});
		keyboardGroup.add(shortcutRow);

		const shortcutButton = new Gtk.Button({
			valign: Gtk.Align.CENTER,
			css_classes: ["flat"],
		});
		shortcutRow.add_suffix(shortcutButton);

		shortcutSettings.updateShortcutDisplay(shortcutButton);
		shortcutSettings.setupNativeShortcutCapture(shortcutButton);

		settings.connect("changed::shortcut", () => {
			shortcutSettings.updateShortcutDisplay(shortcutButton);
		});

		displaySettings.createTopBarIconRow(displayGroup);
		displaySettings.createDialogModeRow(displayGroup);
		displaySettings.createViewModeRow(displayGroup);
		displaySettings.createTiledDisplayModeRow(displayGroup);

		powerOptions.createRestartConfirmationRow(powerGroup);
		powerOptions.createPowerOffConfirmationRow(powerGroup);
		powerOptions.createLogoutConfirmationRow(powerGroup);
		powerOptions.createHibernateRow(hibernateGroup, window);
	}
}
