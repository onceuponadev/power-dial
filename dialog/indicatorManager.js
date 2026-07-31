import Clutter from "gi://Clutter";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

export class IndicatorManager {
	constructor(settings, powerActions, showPowerMenuCallback) {
		this._settings = settings;
		this._powerActions = powerActions;
		this._showPowerMenuCallback = showPowerMenuCallback;
		this._indicator = null;
		this._settingsConnectionIds = [];
		this._clickGesture = null;
	}

	_createOverlayIndicator() {
		this._indicator = new PanelMenu.Button(0.0, "Power Dial", true);

		const icon = new St.Icon({
			icon_name: "system-shutdown-symbolic",
			style_class: "system-status-icon",
		});
		this._indicator.add_child(icon);

		if (Clutter.ClickGesture) {
			this._clickGesture = new Clutter.ClickGesture();
			this._clickGesture.set_recognize_on_press(true);
			this._clickGesture.connect("recognize", () => {
				this._showPowerMenuCallback();
			});
			this._indicator.add_action(this._clickGesture);
		} else {
			this._indicator.connect("button-press-event", (_actor, event) => {
				if (event.get_button() === Clutter.BUTTON_PRIMARY) {
					this._showPowerMenuCallback();
					return Clutter.EVENT_STOP;
				}
				return Clutter.EVENT_PROPAGATE;
			});
		}

		this._indicator.connect("key-press-event", (_actor, event) => {
			const symbol = event.get_key_symbol();
			if (
				symbol === Clutter.KEY_Return ||
				symbol === Clutter.KEY_KP_Enter ||
				symbol === Clutter.KEY_space
			) {
				this._showPowerMenuCallback();
				return Clutter.EVENT_STOP;
			}
			return Clutter.EVENT_PROPAGATE;
		});

		Main.panel.addToStatusArea("power-dial", this._indicator, 0, "right");
	}

	_createDropdownIndicator() {
		this._indicator = new PanelMenu.Button(0.5, "Power Dial", false);

		const icon = new St.Icon({
			icon_name: "system-shutdown-symbolic",
			style_class: "system-status-icon",
		});
		this._indicator.add_child(icon);

		this._populateDropdownMenu();

		Main.panel.addToStatusArea("power-dial", this._indicator, 0, "right");
	}

	_populateDropdownMenu() {
		const menu = this._indicator.menu;
		menu.removeAll();

		const suspendItem = new PopupMenu.PopupImageMenuItem(
			"Suspend", "media-playback-pause-symbolic");
		suspendItem.connect("activate", () => {
			this._powerActions.suspend();
		});
		menu.addMenuItem(suspendItem);

		const lockItem = new PopupMenu.PopupImageMenuItem(
			"Lock", "system-lock-screen-symbolic");
		lockItem.connect("activate", () => {
			this._powerActions.lock();
		});
		menu.addMenuItem(lockItem);

		const restartItem = new PopupMenu.PopupImageMenuItem(
			"Restart", "system-reboot-symbolic");
		restartItem.connect("activate", () => {
			this._powerActions.reboot();
		});
		menu.addMenuItem(restartItem);

		const powerOffItem = new PopupMenu.PopupImageMenuItem(
			"Power Off", "system-shutdown-symbolic");
		powerOffItem.connect("activate", () => {
			this._powerActions.powerOff();
		});
		menu.addMenuItem(powerOffItem);

		if (this._settings.get_boolean("enable-hibernate")) {
			const hibernateItem = new PopupMenu.PopupImageMenuItem(
				"Hibernate", "dialog-error-symbolic");
			hibernateItem._icon.set_pivot_point(0.5, 0.5);
			hibernateItem._icon.rotation_angle_z = 90;
			hibernateItem.connect("activate", () => {
				this._powerActions.hibernate();
			});
			menu.addMenuItem(hibernateItem);
		}

		menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		const logoutItem = new PopupMenu.PopupImageMenuItem(
			"Log Out", "system-log-out-symbolic");
		logoutItem.connect("activate", () => {
			this._powerActions.logout();
		});
		menu.addMenuItem(logoutItem);
	}

	_createIndicator() {
		const dialogMode = this._settings.get_string("dialog-mode");

		if (dialogMode === "dropdown") {
			this._createDropdownIndicator();
		} else {
			this._createOverlayIndicator();
		}
	}

	_destroyIndicator() {
		if (this._indicator) {
			this._indicator.destroy();
			this._indicator = null;
		}
		this._clickGesture = null;
	}

	_rebuildIndicator() {
		const showIcon = this._settings.get_boolean("show-top-bar-icon");
		this._destroyIndicator();
		if (showIcon)
			this._createIndicator();
	}

	_handleTopBarIconSettingChanged() {
		const showIcon = this._settings.get_boolean("show-top-bar-icon");

		if (showIcon && !this._indicator) {
			this._createIndicator();
		} else if (!showIcon && this._indicator) {
			this._destroyIndicator();
		}
	}

	hasDropdownMenu() {
		if (!this._indicator || !this._indicator.menu)
			return false;

		if (Main.overview.visible)
			return true;

		const panelBox = Main.layoutManager.panelBox;
		if (!panelBox.visible || panelBox.y < 0)
			return false;

		const trackedActors = Main.layoutManager._trackedActors;
		if (trackedActors) {
			const tracked = trackedActors.find(a => a.actor === panelBox);
			if (!tracked || !tracked.affectsStruts)
				return false;
		}

		return true;
	}

	toggleDropdownMenu() {
		this._indicator.menu.toggle();
	}

	setup() {
		if (this._settings.get_boolean("show-top-bar-icon"))
			this._createIndicator();

		const iconId = this._settings.connect(
			"changed::show-top-bar-icon",
			() => this._handleTopBarIconSettingChanged()
		);
		this._settingsConnectionIds.push(iconId);

		const modeId = this._settings.connect(
			"changed::dialog-mode",
			() => this._rebuildIndicator()
		);
		this._settingsConnectionIds.push(modeId);

		const hibernateId = this._settings.connect(
			"changed::enable-hibernate",
			() => {
				if (this._indicator && this._indicator.menu)
					this._populateDropdownMenu();
			}
		);
		this._settingsConnectionIds.push(hibernateId);
	}

	destroy() {
		for (const id of this._settingsConnectionIds)
			this._settings.disconnect(id);
		this._settingsConnectionIds = [];

		this._destroyIndicator();
	}
}
