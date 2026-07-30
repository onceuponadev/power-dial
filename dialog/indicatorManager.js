import Clutter from "gi://Clutter";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

export class IndicatorManager {
	constructor(settings, showPowerMenuCallback) {
		this._settings = settings;
		this._showPowerMenuCallback = showPowerMenuCallback;
		this._indicator = null;
		this._settingsConnectionId = null;
		this._clickGesture = null;
	}

	_createIndicator() {
		// dontCreateMenu=true: GNOME 50+ PanelMenu.Button installs a
		// ClickGesture that only toggles this.menu. We open a ModalDialog,
		// so skip the menu and handle the click ourselves.
		this._indicator = new PanelMenu.Button(0.0, "Power Dial", true);

		const icon = new St.Icon({
			icon_name: "system-shutdown-symbolic",
			style_class: "system-status-icon",
		});
		this._indicator.add_child(icon);

		if (Clutter.ClickGesture) {
			// Same pattern as PanelMenu.Button on GNOME 50: recognize on press.
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

	_handleTopBarIconSettingChanged() {
		const showIcon = this._settings.get_boolean("show-top-bar-icon");

		if (showIcon && !this._indicator) {
			this._createIndicator();
		} else if (!showIcon && this._indicator) {
			this._destroyIndicator();
		}
	}

	_destroyIndicator() {
		if (this._indicator) {
			this._indicator.destroy();
			this._indicator = null;
		}
		this._clickGesture = null;
	}

	setup() {
		if (this._settings.get_boolean("show-top-bar-icon")) {
			this._createIndicator();
		}

		this._settingsConnectionId = this._settings.connect(
			"changed::show-top-bar-icon",
			() => {
				this._handleTopBarIconSettingChanged();
			}
		);
	}

	destroy() {
		if (this._settingsConnectionId) {
			this._settings.disconnect(this._settingsConnectionId);
			this._settingsConnectionId = null;
		}

		this._destroyIndicator();
	}
}
