import Adw from "gi://Adw";
import Gtk from "gi://Gtk";

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

	createHibernateRow(powerGroup) {
		const hibernateRow = new Adw.ActionRow({
			title: "Enable Hibernate",
			subtitle: "Show hibernate option (only if your system supports it)",
		});
		powerGroup.add(hibernateRow);

		const hibernateToggle = new Gtk.Switch({
			active: this._settings.get_boolean("enable-hibernate"),
			valign: Gtk.Align.CENTER,
		});
		hibernateRow.add_suffix(hibernateToggle);

		hibernateToggle.connect("notify::active", () => {
			this._settings.set_boolean("enable-hibernate", hibernateToggle.get_active());
		});

		return hibernateRow;
	}
}

