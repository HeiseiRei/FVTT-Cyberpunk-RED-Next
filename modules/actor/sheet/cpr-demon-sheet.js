import CPRChat from "../../chat/cpr-chat.js";
import SystemUtils from "../../utils/cpr-systemUtils.js";
import createImageContextMenu from "../../utils/cpr-imageContextMenu.js";

const TextEditor = foundry.applications.ux.TextEditor.implementation;
const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Implement the Demon sheet, which extends ActorSheetV2 directly from Foundry. This does
 * not extend CPRActorSheet, as there is very little overlap between Demons and mooks/characters.
 *
 * @extends {ActorSheetV2}
 */
export default class CPRDemonActorSheet extends HandlebarsApplicationMixin(
  ActorSheetV2
) {
  static DEFAULT_OPTIONS = {
    classes: ["sheet", "actor", "cpr-demon-sheet-v2"],
    position: { width: 600 },
    window: { icon: "fa-solid fa-skull", resizable: true },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    sheet: {
      template:
        "systems/cyberpunk-red-core/templates/actor/cpr-demon-sheet.hbs",
      scrollable: [""],
    },
  };

  /**
   * The token this sheet was opened for, if any. Always a TokenDocument or null.
   *
   * @returns {TokenDocument|null}
   */
  get token() {
    return this.options.token ?? this.document.token ?? null;
  }

  /**
   * Honor the "resizeCPRSheets" system setting: a fixed starting height when it is enabled,
   * and an automatic height otherwise.
   *
   * @override
   */
  _initializeApplicationOptions(options) {
    const applicationOptions = super._initializeApplicationOptions(options);
    const resizeCPRSheets = game.settings.get(
      game.system.id,
      "resizeCPRSheets"
    );
    applicationOptions.position.height = resizeCPRSheets ? 275 : "auto";
    return applicationOptions;
  }

  /**
   * Get actor data into a more convenient organized structure.
   * Remember, this data is on the DemonActorSheet object, not the CPRActor
   * object it is tied to. (this.actor)
   *
   * @override
   * @returns {Object} context - a curated structure of actorSheet data
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const { actor } = this;
    const sheetData = {
      ...context,
      actor,
      data: actor.toObject(false),
      editable: this.isEditable,
      owner: actor.isOwner,
      limited: actor.limited,
      title: this.title,
      cssClass: this.isEditable ? "editable" : "locked",
    };
    sheetData.enrichedHTML = {};
    sheetData.enrichedHTML.notes = await TextEditor.enrichHTML(
      this.actor.system.notes,
      { async: true }
    );
    return sheetData;
  }

  /**
   * The image context menu is delegated from the application element, which survives re-renders,
   * so it is created once rather than on every render.
   *
   * @override
   */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this._createDemonImageContextMenu(this.element);
  }

  /**
   * Activate listeners for the sheet after each render.
   *
   * @override
   */
  async _onRender(context, options) {
    await super._onRender(context, options);
    $(this.element)
      .find(".rollable")
      .click((event) => this._onRoll(event));
  }

  /**
   * Dispatcher that executes a roll based on the "type" passed in the event. While very similar
   * to _onRoll in CPRActor, Demon sheets have far fewer cases to consider, and copying some of the code
   * here seemed better than making them extend a 1000-line class where most of it didn't apply.
   *
   * @private
   * @callback
   * @param {Object} event - object with details of the event
   */
  async _onRoll(event) {
    const rollName = SystemUtils.GetEventDatum(event, "data-roll-title");
    const cprRoll = this.actor.createStatRoll(rollName);

    const keepRolling = await cprRoll.handleRollDialog(event, this.actor);
    if (!keepRolling) {
      return;
    }
    await cprRoll.roll();

    // output to chat
    const token = this.token === null ? null : this.token._id;
    cprRoll.entityData = { actor: this.actor.id, token };
    CPRChat.RenderRollCard(cprRoll);
  }

  /**
   * Sets up a ContextMenu that appears when the Actor's image is right clicked.
   * Enables the user to share the image with other players.
   *
   * @param {HTMLElement} html - The application element
   * @returns {object} The created ContextMenu
   */
  _createDemonImageContextMenu(html) {
    return createImageContextMenu(html, ".demon-image", this.actor);
  }
}
