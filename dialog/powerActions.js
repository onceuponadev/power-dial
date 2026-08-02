import Gio from "gi://Gio";
import GLib from "gi://GLib";

export class PowerActions {
	constructor(settings) {
		this._settings = settings;
	}

	_callLogind(method, interactive) {
		Gio.DBus.system.call(
			"org.freedesktop.login1",
			"/org/freedesktop/login1",
			"org.freedesktop.login1.Manager",
			method,
			new GLib.Variant("(b)", [interactive]),
			null,
			Gio.DBusCallFlags.NONE,
			-1,
			null,
			null
		);
	}

	logout() {
		const confirmationMode = this._settings.get_string("logout-confirmation");
		const mode = confirmationMode === "immediate" ? 2 : 0;
		
		Gio.DBus.session.call(
			"org.gnome.SessionManager",
			"/org/gnome/SessionManager",
			"org.gnome.SessionManager",
			"Logout",
			new GLib.Variant("(u)", [mode]),
			null,
			Gio.DBusCallFlags.NONE,
			-1,
			null,
			null
		);
	}

	reboot() {
		const confirmationMode = this._settings.get_string("restart-confirmation");
		
		if (confirmationMode === "immediate") {
			this._callLogind("Reboot", false);
		} else {
			Gio.DBus.session.call(
				"org.gnome.SessionManager",
				"/org/gnome/SessionManager",
				"org.gnome.SessionManager",
				"Reboot",
				null,
				null,
				Gio.DBusCallFlags.NONE,
				-1,
				null,
				null
			);
		}
	}

	powerOff() {
		const confirmationMode = this._settings.get_string("poweroff-confirmation");
		
		if (confirmationMode === "immediate") {
			this._callLogind("PowerOff", false);
		} else {
			Gio.DBus.session.call(
				"org.gnome.SessionManager",
				"/org/gnome/SessionManager",
				"org.gnome.SessionManager",
				"Shutdown",
				null,
				null,
				Gio.DBusCallFlags.NONE,
				-1,
				null,
				null
			);
		}
	}

	suspend() {
		this._callLogind("Suspend", true);
	}

	lock() {
		Gio.DBus.session.call(
			"org.gnome.ScreenSaver",
			"/org/gnome/ScreenSaver",
			"org.gnome.ScreenSaver",
			"Lock",
			null,
			null,
			Gio.DBusCallFlags.NONE,
			-1,
			null,
			null
		);
	}

	hibernate() {
		if (!this._settings.get_boolean("hibernate-available"))
			return;
		this._callLogind("Hibernate", true);
	}
}
