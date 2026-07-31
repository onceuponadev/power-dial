import St from "gi://St";
import GLib from "gi://GLib";
import Clutter from "gi://Clutter";
import * as ModalDialog from "resource:///org/gnome/shell/ui/modalDialog.js";

// St.BoxLayout gained the `orientation` property in GNOME 48 and dropped the
// legacy `vertical` boolean in GNOME 50. Detect once which one the running
// shell supports so the dialog builds cleanly on GNOME 45 through 50.
const VERTICAL_BOX_PROPS = "orientation" in St.BoxLayout.prototype
	? { orientation: Clutter.Orientation.VERTICAL }
	: { vertical: true };

export class DialogManager {
	constructor(settings, powerActions) {
		this._settings = settings;
		this._powerActions = powerActions;
		this._dialog = null;
		this._isDialogOpen = false;
		this._tiles = null;
		this._currentTileIndex = 0;
		this._focusTimeoutId = null;
	}

	_iconMap = {
		"Suspend": "media-playback-pause-symbolic",
		"Lock": "system-lock-screen-symbolic",
		"Restart": "system-reboot-symbolic",
		"Power Off": "system-shutdown-symbolic",
		"Hibernate": "dialog-error-symbolic",
		"Log Out": "system-log-out-symbolic",
	};

	_rotateIcon(icon, labelText) {
		if (labelText === "Hibernate") {
			icon.set_pivot_point(0.5, 0.5);
			icon.rotation_angle_z = 90;
		}
	}

	_showPowerMenu() {
		// Toggle closed if already open
		if (this._isDialogOpen) {
			if (this._dialog)
				this._dialog.close();
			else
				this._isDialogOpen = false;
			return;
		}

		const dialog = new ModalDialog.ModalDialog({
			styleClass: "power-dial-dialog",
		});

		const viewMode = this._settings.get_string("view-mode");
		if (viewMode === "pill")
			dialog.add_style_class_name("pill-mode");

		this._dialog = dialog;
		this._isDialogOpen = true;

		const box = new St.BoxLayout({
			...VERTICAL_BOX_PROPS,
			x_expand: true,
			style_class: "power-dial-box",
			can_focus: false,
		});
		dialog.contentLayout.add_child(box);

		const title = new St.Label({
			text: "Power Dial",
			style_class: "headline",
			x_expand: true,
			x_align: Clutter.ActorAlign.START,
		});
		box.add_child(title);

		this._renderDialogView(box);

		if (
			this._settings.get_string("view-mode") === "tiled" &&
			this._tiles &&
			this._tiles.length > 0
		) {
			if (this._focusTimeoutId) {
				GLib.Source.remove(this._focusTimeoutId);
				this._focusTimeoutId = null;
			}
			this._focusTimeoutId = GLib.timeout_add(
				GLib.PRIORITY_DEFAULT,
				50,
				() => {
					if (this._tiles?.[0]) {
						this._tiles[0].grab_key_focus();
						this._tiles[0].add_style_class_name("focused-tile");
					}
					this._focusTimeoutId = null;
					return GLib.SOURCE_REMOVE;
				}
			);
		}

		dialog.setButtons([
			{
				label: "Cancel",
				action: () => dialog.close(),
				default: true,
				key: Clutter.KEY_Escape,
			},
		]);

		if (viewMode === "pill") {
			const buttonBox = dialog.buttonLayout;
			const cancelButton = buttonBox.get_first_child();
			if (cancelButton)
				cancelButton.add_style_class_name("pill-cancel");
		}

		dialog.connect("closed", () => {
			this._dialog = null;
			this._isDialogOpen = false;
			if (this._tiles) {
				this._tiles.forEach((tile) => {
					tile.remove_style_class_name("focused-tile");
				});
			}
			this._tiles = null;
			this._currentTileIndex = 0;
		});

		// open() returns false when the modal grab cannot be taken; clear the
		// latch so a later activation can try again.
		if (!dialog.open()) {
			this._dialog = null;
			this._isDialogOpen = false;
			dialog.destroy();
		}
	}

	_renderDialogView(box) {
		const viewMode = this._settings.get_string("view-mode");

		switch (viewMode) {
			case "tiled":
				this._renderTiledView(box);
				break;
			case "pill":
				this._renderPillView(box);
				break;
			case "stacked":
			default:
				this._renderStackedView(box);
				break;
		}
	}

	_renderStackedView(box) {
		const createButton = (labelText, iconName, action, styleClass) => {
			const button = new St.Button({
				style_class: `button ${styleClass || ""}`,
				style: "padding: 0;",
				can_focus: true,
				x_expand: true,
			});

			const buttonBox = new St.BoxLayout({
				style: "spacing: 0; padding: 0;",
			});

			const labelContainer = new St.BoxLayout({
				style: "padding: 0;",
				width: 256,
				x_align: Clutter.ActorAlign.CENTER,
			});
			const powerLabel = new St.Label({
				text: labelText,
				y_align: Clutter.ActorAlign.CENTER,
				x_align: Clutter.ActorAlign.CENTER,
				style_class: "power-option-label",
			});
			labelContainer.add_child(powerLabel);
			buttonBox.add_child(labelContainer);

			const iconContainer = new St.BoxLayout({
				style_class: "power-option-icon-container",
				width: 44,
				height: 38,
				x_align: Clutter.ActorAlign.CENTER,
				y_align: Clutter.ActorAlign.CENTER,
			});
			const icon = new St.Icon({
				icon_name: iconName,
				icon_size: 20,
				y_align: Clutter.ActorAlign.CENTER,
				x_align: Clutter.ActorAlign.CENTER,
				x_expand: true,
				y_expand: true,
				style_class: "power-option-icon",
			});
			this._rotateIcon(icon, labelText);
			iconContainer.add_child(icon);

			button.set_child(buttonBox);

			button.add_child(iconContainer);
			iconContainer.x = 258;
			iconContainer.y = 2;
			button.connect("clicked", () => {
				action();
				this._dialog?.close();
			});
			return button;
		};

		box.add_child(
			createButton(
				"Suspend",
				this._iconMap["Suspend"],
				this._powerActions.suspend.bind(this._powerActions),
				"suspend-button"
			)
		);
		box.add_child(
			createButton(
				"Lock",
				this._iconMap["Lock"],
				this._powerActions.lock.bind(this._powerActions),
				"lock-button"
			)
		);
		box.add_child(
			createButton(
				"Restart",
				this._iconMap["Restart"],
				this._powerActions.reboot.bind(this._powerActions),
				"restart-button"
			)
		);
		box.add_child(
			createButton(
				"Power Off",
				this._iconMap["Power Off"],
				this._powerActions.powerOff.bind(this._powerActions),
				"poweroff-button"
			)
		);

		if (this._settings.get_boolean("enable-hibernate")) {
			box.add_child(
				createButton(
					"Hibernate",
					this._iconMap["Hibernate"],
					this._powerActions.hibernate.bind(this._powerActions),
					"hibernate-button"
				)
			);
		}

		box.add_child(
			createButton(
				"Log Out",
				this._iconMap["Log Out"],
				this._powerActions.logout.bind(this._powerActions),
				"logout-button"
			)
		);
	}

	_renderPillView(box) {
		const createPill = (labelText, iconName, action, styleClass) => {
			const isFullWidth = styleClass && styleClass.includes("pill-button-full");

			const button = new St.Button({
				style_class: `pill-button ${styleClass || ""}`,
				can_focus: true,
				x_expand: true,
			});

			const pillBox = new St.BoxLayout({
				x_expand: true,
				y_align: Clutter.ActorAlign.CENTER,
			});

			const iconContainer = new St.BoxLayout({
				style_class: "pill-icon-container",
				x_align: Clutter.ActorAlign.CENTER,
				y_align: Clutter.ActorAlign.CENTER,
			});
			const icon = new St.Icon({
				icon_name: iconName,
				icon_size: 18,
				x_align: Clutter.ActorAlign.CENTER,
				y_align: Clutter.ActorAlign.CENTER,
				x_expand: true,
				y_expand: true,
				style_class: "pill-icon",
			});
			this._rotateIcon(icon, labelText);
			iconContainer.add_child(icon);
			pillBox.add_child(iconContainer);

			const label = new St.Label({
				text: labelText,
				y_align: Clutter.ActorAlign.CENTER,
				x_align: isFullWidth ? Clutter.ActorAlign.CENTER : Clutter.ActorAlign.START,
				x_expand: true,
				style_class: "pill-label",
			});
			pillBox.add_child(label);

			button.set_child(pillBox);
			button.connect("clicked", () => {
				action();
				this._dialog?.close();
			});
			return button;
		};

		const gridContainer = new St.BoxLayout({
			...VERTICAL_BOX_PROPS,
			style: "spacing: 8px;",
			x_expand: true,
			can_focus: false,
		});

		const firstRow = new St.BoxLayout({
			style: "spacing: 8px;",
			x_expand: true,
			can_focus: false,
		});

		const secondRow = new St.BoxLayout({
			style: "spacing: 8px;",
			x_expand: true,
			can_focus: false,
		});

		firstRow.add_child(
			createPill("Suspend", this._iconMap["Suspend"],
				this._powerActions.suspend.bind(this._powerActions))
		);
		firstRow.add_child(
			createPill("Lock", this._iconMap["Lock"],
				this._powerActions.lock.bind(this._powerActions))
		);

		secondRow.add_child(
			createPill("Power Off", this._iconMap["Power Off"],
				this._powerActions.powerOff.bind(this._powerActions))
		);
		secondRow.add_child(
			createPill("Restart", this._iconMap["Restart"],
				this._powerActions.reboot.bind(this._powerActions))
		);

		gridContainer.add_child(firstRow);
		gridContainer.add_child(secondRow);

		const hibernateEnabled = this._settings.get_boolean("enable-hibernate");

		if (hibernateEnabled) {
			const thirdRow = new St.BoxLayout({
				style: "spacing: 8px;",
				x_expand: true,
				can_focus: false,
			});

			thirdRow.add_child(
				createPill("Hibernate", this._iconMap["Hibernate"],
					this._powerActions.hibernate.bind(this._powerActions))
			);
			thirdRow.add_child(
				createPill("Log Out", this._iconMap["Log Out"],
					this._powerActions.logout.bind(this._powerActions))
			);
			gridContainer.add_child(thirdRow);
		} else {
			const logoutRow = new St.BoxLayout({
				style: "spacing: 8px;",
				x_expand: true,
				can_focus: false,
			});

			logoutRow.add_child(
				createPill("Log Out", this._iconMap["Log Out"],
					this._powerActions.logout.bind(this._powerActions),
					"pill-button-full")
			);
			gridContainer.add_child(logoutRow);
		}

		box.add_child(gridContainer);
	}

	_renderTiledView(box) {
		this._tiles = [];
		this._currentTileIndex = 0;

		const tiledDisplayMode = this._settings.get_string("tiled-display-mode");

		const createTile = (labelText, iconName, action, styleClass) => {
			let tileClass;
			if (tiledDisplayMode === "icons-only") {
				tileClass = "tile-icons-only";
			} else if (tiledDisplayMode === "label-only") {
				tileClass = "tile-label-only";
			} else {
				tileClass = "tile-label-with-icons";
			}

			const tile = new St.Button({
				style_class: `${tileClass} ${styleClass || ""}`,
				can_focus: true,
				x_expand: true,
				y_expand: true,
			});

			let tileBox;

			switch (tiledDisplayMode) {
				case "icons-only":
					tileBox = new St.BoxLayout({
						style: "spacing: 0px;",
						x_align: Clutter.ActorAlign.CENTER,
						y_align: Clutter.ActorAlign.CENTER,
					});

					const iconsOnlyIcon = new St.Icon({
						icon_name: iconName,
						icon_size: 30,
						x_align: Clutter.ActorAlign.CENTER,
						y_align: Clutter.ActorAlign.CENTER,
						style_class: "system-status-icon",
					});
					this._rotateIcon(iconsOnlyIcon, labelText);
					tileBox.add_child(iconsOnlyIcon);
					tile.set_child(tileBox);
					break;

				case "label-only":
					tileBox = new St.BoxLayout({
						style: "spacing: 0px;",
						x_align: Clutter.ActorAlign.CENTER,
						y_align: Clutter.ActorAlign.CENTER,
					});

					tileBox.add_child(
						new St.Label({
							text: labelText,
							style_class: "tile-label-only-text",
							x_align: Clutter.ActorAlign.CENTER,
							y_align: Clutter.ActorAlign.CENTER,
						})
					);
					tile.set_child(tileBox);
					break;

				case "label-with-icons":
				default:
					tileBox = new St.BoxLayout();

					const isFullWidth = styleClass && styleClass.includes("logout-tile-full");

					if (isFullWidth) {
						const labelContainer = new St.BoxLayout();

						const powerLabel = new St.Label({
							text: labelText,
							style_class: "tile-label",
						});
						labelContainer.add_child(powerLabel);
						tileBox.add_child(labelContainer);

						const iconContainer = new St.BoxLayout({
							style_class: "power-option-icon-container-tile-full",
							height: 40,
							x_align: Clutter.ActorAlign.CENTER,
							y_align: Clutter.ActorAlign.CENTER,
						});
						const icon = new St.Icon({
							icon_name: iconName,
							icon_size: 24,
							y_align: Clutter.ActorAlign.CENTER,
							x_align: Clutter.ActorAlign.CENTER,
							x_expand: true,
							y_expand: true,
							style_class: "power-option-icon",
						});
						this._rotateIcon(icon, labelText);
						iconContainer.add_child(icon);

						tile.set_child(tileBox);
						tile.add_child(labelContainer);
						tile.add_child(iconContainer);
						iconContainer.x = 2;
						iconContainer.y = 2;
					} else {
						const labelContainer = new St.BoxLayout();

						const powerLabel = new St.Label({
							text: labelText,
							style_class: "tile-label",
						});
						labelContainer.add_child(powerLabel);
						tileBox.add_child(labelContainer);

						const iconContainer = new St.BoxLayout({
							style_class: "power-option-icon-container-tile",
							width: 142,
							height: 40,
							x_align: Clutter.ActorAlign.CENTER,
							y_align: Clutter.ActorAlign.CENTER,
						});
						const icon = new St.Icon({
							icon_name: iconName,
							icon_size: 24,
							y_align: Clutter.ActorAlign.CENTER,
							x_align: Clutter.ActorAlign.CENTER,
							x_expand: true,
							y_expand: true,
							style_class: "power-option-icon",
						});
						this._rotateIcon(icon, labelText);
						iconContainer.add_child(icon);

						tile.set_child(tileBox);
						tile.add_child(labelContainer);
						tile.add_child(iconContainer);
						iconContainer.x = 2;
						iconContainer.y = 2;
					}
					break;
			}
			tile.connect("clicked", () => {
				action();
				this._dialog?.close();
			});

			tile.connect("key-press-event", (_actor, event) => {
				const key = event.get_key_symbol();

				switch (key) {
					case Clutter.KEY_Left:
						this._navigateTiles(-1);
						return Clutter.EVENT_STOP;
					case Clutter.KEY_Right:
					case Clutter.KEY_Tab:
						this._navigateTiles(1);
						return Clutter.EVENT_STOP;
					case Clutter.KEY_Up:
						this._navigateTilesVertical(-1);
						return Clutter.EVENT_STOP;
					case Clutter.KEY_Down:
						this._navigateTilesVertical(1);
						return Clutter.EVENT_STOP;
					case Clutter.KEY_ISO_Left_Tab:
						this._navigateTiles(-1);
						return Clutter.EVENT_STOP;
					case Clutter.KEY_Return:
					case Clutter.KEY_KP_Enter:
						action();
						this._dialog?.close();
						return Clutter.EVENT_STOP;
				}

				return Clutter.EVENT_PROPAGATE;
			});

			this._tiles.push(tile);

			return tile;
		};

		const gridContainer = new St.BoxLayout({
			...VERTICAL_BOX_PROPS,
			style: "spacing: 8px;",
			x_expand: true,
			can_focus: false,
		});

		const firstRow = new St.BoxLayout({
			style: "spacing: 8px;",
			x_expand: true,
			can_focus: false,
		});

		const secondRow = new St.BoxLayout({
			style: "spacing: 8px;",
			x_expand: true,
			can_focus: false,
		});

		firstRow.add_child(
			createTile(
				"Suspend",
				this._iconMap["Suspend"],
				this._powerActions.suspend.bind(this._powerActions),
				"suspend-tile"
			)
		);
		firstRow.add_child(
			createTile(
				"Lock",
				this._iconMap["Lock"],
				this._powerActions.lock.bind(this._powerActions),
				"lock-tile"
			)
		);

		secondRow.add_child(
			createTile(
				"Power Off",
				this._iconMap["Power Off"],
				this._powerActions.powerOff.bind(this._powerActions),
				"poweroff-tile"
			)
		);
		secondRow.add_child(
			createTile(
				"Restart",
				this._iconMap["Restart"],
				this._powerActions.reboot.bind(this._powerActions),
				"restart-tile"
			)
		);

		gridContainer.add_child(firstRow);
		gridContainer.add_child(secondRow);

		const hibernateEnabled = this._settings.get_boolean("enable-hibernate");

		if (hibernateEnabled) {
			const thirdRow = new St.BoxLayout({
				style: "spacing: 8px;",
				x_expand: true,
				can_focus: false,
			});

			thirdRow.add_child(
				createTile(
					"Hibernate",
					this._iconMap["Hibernate"],
					this._powerActions.hibernate.bind(this._powerActions),
					"hibernate-tile"
				)
			);
			thirdRow.add_child(
				createTile(
					"Log Out",
					this._iconMap["Log Out"],
					this._powerActions.logout.bind(this._powerActions),
					"logout-tile"
				)
			);
			gridContainer.add_child(thirdRow);
		} else {
			const logoutRow = new St.BoxLayout({
				style: "spacing: 8px;",
				x_expand: true,
				can_focus: false,
			});

			logoutRow.add_child(
				createTile(
					"Log Out",
					this._iconMap["Log Out"],
					this._powerActions.logout.bind(this._powerActions),
					"logout-tile logout-tile-full"
				)
			);
			gridContainer.add_child(logoutRow);
		}

		box.add_child(gridContainer);
	}

	_navigateTiles(direction) {
		if (!this._tiles || this._tiles.length === 0) {
			return;
		}

		if (this._tiles[this._currentTileIndex]) {
			this._tiles[this._currentTileIndex].remove_style_class_name(
				"focused-tile"
			);
		}

		let newIndex = this._currentTileIndex + direction;

		if (newIndex < 0) {
			newIndex = this._tiles.length - 1;
		} else if (newIndex >= this._tiles.length) {
			newIndex = 0;
		}

		this._currentTileIndex = newIndex;

		if (this._tiles[this._currentTileIndex]) {
			this._tiles[this._currentTileIndex].grab_key_focus();
			this._tiles[this._currentTileIndex].add_style_class_name(
				"focused-tile"
			);
		}
	}

	_navigateTilesVertical(direction) {
		if (!this._tiles || this._tiles.length === 0) {
			return;
		}

		const tilesPerRow = 2;
		const currentRow = Math.floor(this._currentTileIndex / tilesPerRow);
		const currentCol = this._currentTileIndex % tilesPerRow;

		if (this._tiles[this._currentTileIndex]) {
			this._tiles[this._currentTileIndex].remove_style_class_name(
				"focused-tile"
			);
		}

		let targetIndex;

		if (direction === -1) {
			// Up
			if (currentRow === 0) {
				targetIndex = 1 * tilesPerRow + currentCol;
			} else {
				targetIndex = (currentRow - 1) * tilesPerRow + currentCol;
			}
		} else {
			// Down
			if (currentRow === 1) {
				targetIndex = 0 * tilesPerRow + currentCol;
			} else {
				targetIndex = (currentRow + 1) * tilesPerRow + currentCol;
			}
		}

		this._currentTileIndex = targetIndex;

		if (this._tiles[this._currentTileIndex]) {
			this._tiles[this._currentTileIndex].grab_key_focus();
			this._tiles[this._currentTileIndex].add_style_class_name(
				"focused-tile"
			);
		}
	}

	destroy() {
		if (this._focusTimeoutId) {
			GLib.Source.remove(this._focusTimeoutId);
			this._focusTimeoutId = null;
		}

		if (this._dialog) {
			this._dialog.close();
			this._dialog = null;
			this._isDialogOpen = false;
		}
	}

	get isDialogOpen() {
		return this._isDialogOpen;
	}
}
