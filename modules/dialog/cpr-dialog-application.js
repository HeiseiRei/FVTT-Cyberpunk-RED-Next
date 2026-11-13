import LOGGER from "../utils/cpr-logger.js";
import SystemUtils from "../utils/cpr-systemUtils.js";

const { ApplicationV2 } = foundry.applications.api;

/**
 * Keys of the legacy (AppV1 style) option object that callers pass to CPRDialog and its
 * subclasses. They are kept so that every `showDialog(data, { title, template, ... })`
 * call in the system keeps working unchanged on top of ApplicationV2.
 */
const FRAME_OPTION_KEYS = ["width", "height", "top", "left", "resizable", "classes", "id"];

/**
 * ApplicationV2 window used for nearly every prompt in the system.
 *
 * A dialog edits a plain object (`this.object`). Its template renders a `<form>`, and
 * whenever that form changes the form data is merged back into the object and the dialog
 * is re-rendered. `showDialog` resolves with the object once a confirming button is
 * pressed, and rejects with it when the dialog is cancelled or closed.
 */
export default class CPRDialog extends ApplicationV2 {
  /**
   * @param {Object} dialogData - the object edited by this dialog
   * @param {Object} [options] - legacy dialog options, see `defaultDialogOptions`
   */
  constructor(dialogData, options = {}) {
    const dialogOptions = options ?? {};
    super(CPRDialog.#frameOptions(dialogOptions));

    this.object = dialogData;
    this.objectData = dialogData?.object;

    const defaults = this.constructor.defaultDialogOptions;
    this.dialogOptions = foundry.utils.mergeObject(defaults, dialogOptions, {
      inplace: false,
    });
    // Overwrite default buttons if indicated.
    if (this.dialogOptions.overwriteButtons && dialogOptions.buttons) {
      this.dialogOptions.buttons = dialogOptions.buttons;
    }
  }

  /** Callbacks settling the Promise created by `showDialog`. */
  #resolve = null;

  #reject = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["cpr-dialog", "dialog", "cpr-nd-dialog"],
    position: { width: 400, height: "auto" },
    window: { resizable: true },
  };

  /**
   * Default dialog options. Subclasses extend this getter the way they used to extend
   * `defaultOptions`.
   *
   * - `buttons` / `buttonDefault`: buttons rendered by cpr-dialog-buttons.hbs
   * - `overwriteButtons`: replace the default buttons instead of adding to them
   * - `submitOnChange`: merge the form into the object whenever an input changes
   * - `submitOnClose`: merge the form into the object when the dialog is confirmed
   * - `template` / `title`: what to render and the (localizable) window title
   *
   * @returns {Object}
   */
  static get defaultDialogOptions() {
    return {
      buttonDefault: "confirm",
      buttons: {
        confirm: {
          icon: "fas fa-check",
          label: SystemUtils.Localize("CPR.dialog.common.confirm"),
          callback: (dialog) => dialog.confirmDialog(),
        },
        cancel: {
          icon: "fas fa-xmark",
          label: SystemUtils.Localize("CPR.dialog.common.cancel"),
          callback: (dialog) => dialog.closeDialog(),
        },
      },
      overwriteButtons: false, // If calling showDialog with custom buttons, override defaults or not.
      submitOnChange: true,
      submitOnClose: false,
      template: `systems/${game.system.id}/templates/dialog/cpr-default-prompt.hbs`,
      title: "CPR.global.generic.title",
    };
  }

  /**
   * Translate legacy window options (width, height, resizable, ...) into the
   * ApplicationV2 configuration consumed by the constructor.
   *
   * @param {Object} options - legacy dialog options
   * @returns {Object} - ApplicationV2 options
   */
  static #frameOptions(options) {
    const frame = {};
    if (!FRAME_OPTION_KEYS.some((key) => options[key] !== undefined)) return frame;

    const position = {};
    for (const key of ["width", "height", "top", "left"]) {
      if (options[key] !== undefined) position[key] = options[key];
    }
    if (Object.keys(position).length > 0) frame.position = position;
    if (options.resizable !== undefined) {
      frame.window = { resizable: Boolean(options.resizable) };
    }
    if (Array.isArray(options.classes)) {
      frame.classes = Array.from(
        new Set([...CPRDialog.DEFAULT_OPTIONS.classes, ...options.classes])
      );
    }
    if (typeof options.id === "string" && options.id.length > 0) {
      frame.id = options.id;
    }
    return frame;
  }

  /** @override */
  get title() {
    return SystemUtils.Localize(this.dialogOptions.title);
  }

  /**
   * The form rendered by the dialog template.
   *
   * @override
   * @returns {HTMLFormElement|null}
   */
  get form() {
    return this.element?.querySelector("form") ?? null;
  }

  /**
   * Prepares data for the dialog template: every property of the edited object is
   * available at the top level, next to `object`, `options` (the dialog options, which
   * hold the buttons) and `title`.
   *
   * @override
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const data = {
      ...context,
      object: this.object,
      options: this.dialogOptions,
      title: this.title,
    };
    Object.entries(this.object ?? {}).forEach(([key, value]) => {
      data[key] = value;
    });
    return data;
  }

  /** @override */
  async _renderHTML(context) {
    const html = await foundry.applications.handlebars.renderTemplate(
      this.dialogOptions.template,
      context
    );
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content;
  }

  /**
   * Swap in the freshly rendered template. The dialog re-renders on every change, so the
   * focused input and the scroll position are carried over to the new content.
   *
   * @override
   */
  _replaceHTML(result, content) {
    const active = content.contains(document.activeElement)
      ? document.activeElement
      : null;
    const focus = active
      ? {
          id: active.id,
          name: active.getAttribute("name"),
          tag: active.tagName,
          start: CPRDialog.#selection(active, "selectionStart"),
          end: CPRDialog.#selection(active, "selectionEnd"),
        }
      : null;
    const { scrollTop, scrollLeft } = content;

    content.replaceChildren(result);
    content.scrollTop = scrollTop;
    content.scrollLeft = scrollLeft;

    if (!focus) return;
    let target = null;
    if (focus.id) target = content.querySelector(`#${CSS.escape(focus.id)}`);
    if (!target && focus.name) {
      target = content.querySelector(
        `${focus.tag.toLowerCase()}[name="${CSS.escape(focus.name)}"]`
      );
    }
    if (!target) return;
    target.focus({ preventScroll: true });
    if (focus.start !== null && focus.end !== null) {
      try {
        target.setSelectionRange(focus.start, focus.end);
      } catch (err) {
        // Not every input type supports text selection; keeping focus is enough.
      }
    }
  }

  /**
   * Read a selection offset from an element, tolerating inputs that do not support it.
   *
   * @param {HTMLElement} element
   * @param {String} property - "selectionStart" or "selectionEnd"
   * @returns {Number|null}
   */
  static #selection(element, property) {
    try {
      const value = element[property];
      return typeof value === "number" ? value : null;
    } catch (err) {
      return null;
    }
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);

    const { form } = this;
    if (form) {
      // Buttons inside the form would otherwise reload the page on submission.
      form.addEventListener("submit", (event) => event.preventDefault());
      form.addEventListener("change", (event) => this.#onChangeForm(event));
    }
    this._activateListeners($(this.element));

    const defaultButton = this.element.querySelector(".cpr-dialog-button[autofocus]");
    if (options.isFirstRender && defaultButton) defaultButton.focus();
  }

  /**
   * Attach listeners to the rendered dialog. Subclasses extend this and call super.
   *
   * @param {jQuery} html - the dialog element
   */
  _activateListeners(html) {
    html
      .find(".item-checkbox")
      .click((event) => this._itemCheckboxToggle(event)); // Currently unused, see below.

    // Handle button presses.
    html.find(".cpr-dialog-button").click((event) => {
      event.preventDefault();
      const buttonName = event.currentTarget.name;
      const button = this.dialogOptions.buttons[buttonName];
      if (!button) {
        LOGGER.error(`The dialog has no button named ${buttonName}.`);
        return;
      }
      // Execute callback function when dialog buttons are pressed.
      button.callback(this);
    });

    // Buttons rendered by the {{filePicker}} helper.
    html
      .find("button.file-picker")
      .click((event) => this._activateFilePicker(event));
  }

  /**
   * Open a FilePicker for a {{filePicker}} button and write the chosen path into the
   * input the button targets.
   *
   * @param {Event} event - the click on the file picker button
   * @returns {Promise}
   */
  _activateFilePicker(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const field = this.form?.querySelector(
      `[name="${CSS.escape(button.dataset.target ?? "")}"]`
    );
    const picker = new foundry.applications.apps.FilePicker.implementation({
      type: button.dataset.type,
      current: field?.value ?? "",
      callback: (path) => {
        if (!field) return;
        field.value = path;
        field.dispatchEvent(new Event("change", { bubbles: true }));
      },
    });
    return picker.browse();
  }

  /**
   * Merge the form into the object when an input changes.
   *
   * @param {Event} event - the change event
   */
  #onChangeForm(event) {
    if (!this.dialogOptions.submitOnChange) return;
    const formData = this._getFormData();
    if (!formData) return;
    Promise.resolve(this._updateDialogData(event, formData)).catch((err) =>
      LOGGER.error("Could not update the dialog data.", err)
    );
  }

  /**
   * Collect the current values of the dialog form as a flat object.
   *
   * @returns {Object|null} - null if the dialog has no form
   */
  _getFormData() {
    const { form } = this;
    if (!form) return null;
    return new foundry.applications.ux.FormDataExtended(form).object;
  }

  /**
   * This works in the same way it does on the item sheets.
   * It can turn anything into a pseudo checkbox, which look nicer than the default ones.
   *
   * @param {*} event
   */
  _itemCheckboxToggle(event) {
    const dialogData = this.object;
    const target = SystemUtils.GetEventDatum(event, "data-target");
    const value = !foundry.utils.getProperty(dialogData, target);
    if (foundry.utils.hasProperty(dialogData, target)) {
      foundry.utils.setProperty(dialogData, target, value);
    } else {
      LOGGER.error(
        `The target (${target}) does not exist in the dialogData.`,
        dialogData
      );
    }
    this.render();
  }

  /**
   * This will confirm the dialog and resolve the Promise originally created when CPRDialog.showDialog is called.
   * Values still sitting in the form are merged into the object first, so that an input
   * the user typed into without leaving it is not lost.
   *
   * @param {*} event - currently unused
   * @param {Object} options - potential options to pass to this.close; currently unused;
   */
  async confirmDialog(event, options) {
    if (this.dialogOptions.submitOnChange || this.dialogOptions.submitOnClose) {
      const formData = this._getFormData();
      if (formData) {
        await this._updateDialogData(null, formData, { render: false });
      }
    }
    this.#settle(true);
    return this.close(options);
  }

  /**
   * This will cancel/close the dialog and reject the Promise originally created when CPRDialog.showDialog is called.
   *
   * @param {*} event - currently unused
   * @param {Object} options - potential options to pass to this.close; currently unused;
   */
  async closeDialog(event, options) {
    this.#settle(false);
    return this.close(options);
  }

  /**
   * Closing the window any other way (header button, Escape) counts as cancelling.
   *
   * @override
   */
  _onClose(options) {
    super._onClose(options);
    this.#settle(false);
  }

  /**
   * Settle the Promise created by showDialog, once.
   *
   * @param {Boolean} confirmed - resolve (true) or reject (false)
   */
  #settle(confirmed) {
    const callback = confirmed ? this.#resolve : this.#reject;
    this.#resolve = null;
    this.#reject = null;
    if (callback) callback(this.object);
  }

  /**
   * Creates a promise to be resolved when the dialog is confirmed. One can also override default options here.
   *
   * @param {...args<Object>} - The first argument should be the object that is being changed by the dialog.
   *                          - The final argument (optional) is options to pass to the dialog.
   *                          - See defaultDialogOptions for a breakdown of these options.
   *                          - See constructors to know how many arguments each dialog Class expects.
   */
  static async showDialog(...args) {
    return new Promise((resolve, reject) => {
      const dialog = new this(...args);
      dialog.#resolve = () => resolve(args[0]);
      dialog.#reject = () => reject(args[0]);
      dialog.render({ force: true }).catch((err) => {
        LOGGER.error("Could not render the dialog.", err);
        dialog.#settle(false);
      });
    });
  }

  /**
   * Merge updated form data into the object edited by the dialog.
   *
   * @param {Event|null} event - the event which triggered the update, if any
   * @param {Object} formData - Updated dialog data to be merged with the original object.
   * @param {Object} [options]
   * @param {Boolean} [options.render=true] - re-render the dialog with the new data
   */
  async _updateDialogData(event, formData, { render = true } = {}) {
    const fd = foundry.utils.duplicate(formData);
    foundry.utils.mergeObject(this.object, fd);
    if (render) this.render(); // rerenders the dialog with the new data.
  }
}
