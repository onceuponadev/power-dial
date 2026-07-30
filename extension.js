import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { PowerActions } from "./dialog/powerActions.js";
import { KeybindingManager } from "./dialog/keybindingManager.js";
import { DialogManager } from "./dialog/dialogManager.js";
import { IndicatorManager } from "./dialog/indicatorManager.js";

export default class PowerDialExtension extends Extension {
	_showPowerMenu() {
		this._dialogManager._showPowerMenu();
	}

	enable() {
		this._settings = this.getSettings();

		this._powerActions = new PowerActions(this._settings);
		this._dialogManager = new DialogManager(this._settings, this._powerActions);
		this._keybindingManager = new KeybindingManager(
			this._settings,
			this._showPowerMenu.bind(this)
		);
		this._indicatorManager = new IndicatorManager(
			this._settings,
			this._showPowerMenu.bind(this)
		);

		this._keybindingManager.register();
		this._indicatorManager.setup();
	}

	disable() {
		if (this._keybindingManager) {
			this._keybindingManager.destroy();
			this._keybindingManager = null;
		}

		if (this._dialogManager) {
			this._dialogManager.destroy();
			this._dialogManager = null;
		}

		if (this._indicatorManager) {
			this._indicatorManager.destroy();
			this._indicatorManager = null;
		}

		this._powerActions = null;
		this._settings = null;
	}
}
