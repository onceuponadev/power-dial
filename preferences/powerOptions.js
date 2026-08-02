import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

export class PowerOptions {
	constructor(settings) {
		this._settings = settings;
	}

	createRestartConfirmationRow(powerGroup) {
		const restartRow = new Adw.ComboRow({
			title: "Restart",
			subtitle: "Choose whether to show confirmation before restart",
		});
		powerGroup.add(restartRow);

		const restartModel = new Gtk.StringList();
		restartModel.append("Confirm");
		restartModel.append("Immediate");
		restartRow.set_model(restartModel);

		const currentRestartMode = this._settings.get_string("restart-confirmation");
		if (currentRestartMode === "confirm") {
			restartRow.set_selected(0);
		} else if (currentRestartMode === "immediate") {
			restartRow.set_selected(1);
		}

		restartRow.connect("notify::selected", () => {
			const selectedIndex = restartRow.get_selected();
			const selectedMode = selectedIndex === 0 ? "confirm" : "immediate";
			this._settings.set_string("restart-confirmation", selectedMode);
		});

		return restartRow;
	}

	createPowerOffConfirmationRow(powerGroup) {
		const powerOffRow = new Adw.ComboRow({
			title: "Power Off",
			subtitle: "Choose whether to show confirmation before power off",
		});
		powerGroup.add(powerOffRow);

		const powerOffModel = new Gtk.StringList();
		powerOffModel.append("Confirm");
		powerOffModel.append("Immediate");
		powerOffRow.set_model(powerOffModel);

		const currentPowerOffMode = this._settings.get_string("poweroff-confirmation");
		if (currentPowerOffMode === "confirm") {
			powerOffRow.set_selected(0);
		} else if (currentPowerOffMode === "immediate") {
			powerOffRow.set_selected(1);
		}

		powerOffRow.connect("notify::selected", () => {
			const selectedIndex = powerOffRow.get_selected();
			const selectedMode = selectedIndex === 0 ? "confirm" : "immediate";
			this._settings.set_string("poweroff-confirmation", selectedMode);
		});

		return powerOffRow;
	}

	createLogoutConfirmationRow(powerGroup) {
		const logoutRow = new Adw.ComboRow({
			title: "Log Out",
			subtitle: "Choose whether to show confirmation before logout",
		});
		powerGroup.add(logoutRow);

		const logoutModel = new Gtk.StringList();
		logoutModel.append("Confirm");
		logoutModel.append("Immediate");
		logoutRow.set_model(logoutModel);

		const currentLogoutMode = this._settings.get_string("logout-confirmation");
		if (currentLogoutMode === "confirm") {
			logoutRow.set_selected(0);
		} else if (currentLogoutMode === "immediate") {
			logoutRow.set_selected(1);
		}

		logoutRow.connect("notify::selected", () => {
			const selectedIndex = logoutRow.get_selected();
			const selectedMode = selectedIndex === 0 ? "confirm" : "immediate";
			this._settings.set_string("logout-confirmation", selectedMode);
		});

		return logoutRow;
	}

	createHibernateRow(hibernateGroup, window) {
		const available = this._settings.get_boolean("hibernate-available");

		const checkRow = new Adw.ActionRow({
			title: "Check Hibernate Support",
			subtitle: available
				? "Hibernate is supported on this system"
				: "Verify if your system is configured for hibernation",
		});
		hibernateGroup.add(checkRow);

		const checkButton = new Gtk.Button({
			label: available ? "Re-check" : "Check",
			valign: Gtk.Align.CENTER,
			css_classes: ["suggested-action"],
		});
		checkRow.add_suffix(checkButton);

		const hibernateRow = new Adw.ActionRow({
			title: "Enable Hibernate",
			subtitle: "Show hibernate in the power menu",
			sensitive: available,
		});
		hibernateGroup.add(hibernateRow);

		const hibernateToggle = new Gtk.Switch({
			active: this._settings.get_boolean("enable-hibernate"),
			valign: Gtk.Align.CENTER,
			sensitive: available,
		});
		hibernateRow.add_suffix(hibernateToggle);

		hibernateToggle.connect("notify::active", () => {
			this._settings.set_boolean("enable-hibernate", hibernateToggle.get_active());
		});

		const guideRow = new Adw.ActionRow({
			title: "Setup Guide",
			subtitle: "Learn how to enable hibernate on your system",
			activatable: true,
		});
		const guideButton = new Gtk.Button({
			label: "Open",
			valign: Gtk.Align.CENTER,
		});
		guideRow.add_suffix(guideButton);
		hibernateGroup.add(guideRow);

		guideButton.connect("clicked", () => {
			Gio.AppInfo.launch_default_for_uri(
				"https://github.com/onceuponadev/power-dial/blob/main/HIBERNATE.md",
				null
			);
		});

		checkButton.connect("clicked", () => {
			Gio.DBus.system.call(
				"org.freedesktop.login1",
				"/org/freedesktop/login1",
				"org.freedesktop.login1.Manager",
				"CanHibernate",
				null,
				new GLib.VariantType("(s)"),
				Gio.DBusCallFlags.NONE,
				-1,
				null,
				(connection, result) => {
					let canHibernate = false;
					let message = "";

					try {
						const reply = connection.call_finish(result);
						const value = reply.get_child_value(0).get_string()[0];
						canHibernate = value === "yes" || value === "challenge";
						message = canHibernate
							? "Hibernate is supported on this system"
							: "Hibernate is not supported on this system";
					} catch (e) {
						message = "Unable to check hibernate support";
					}

					this._settings.set_boolean("hibernate-available", canHibernate);

					if (!canHibernate) {
						this._settings.set_boolean("enable-hibernate", false);
						hibernateToggle.set_active(false);
					}

					hibernateRow.set_sensitive(canHibernate);
					hibernateToggle.set_sensitive(canHibernate);
					checkRow.set_subtitle(message);
					checkButton.set_label(canHibernate ? "Re-check" : "Check");

					const toast = new Adw.Toast({ title: message });
					window.add_toast(toast);
				}
			);
		});

		return checkRow;
	}
}

