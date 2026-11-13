import CPR from "../system/config.js";
import SystemUtils from "../utils/cpr-systemUtils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Defines behaviors for a window that pops up when the Config Compendia button in
 * system settings is clicked. We go this route because the options available are
 * based on content in game.packs, but game.packs is not defined when settings are
 * configured. So we have present options dynamically when a button is clicked.
 */
export default class CPRCompendiaSettings extends HandlebarsApplicationMixin(
  ApplicationV2
) {
  /**
   * set up default things like the window size and how the form is submitted
   *
   * @override
   * @static
   */
  static DEFAULT_OPTIONS = {
    id: "compendia-config",
    tag: "form",
    window: {
      title: "CPR.settings.compendiumMenu.title",
    },
    position: {
      width: "auto",
      height: "auto",
    },
    form: {
      handler: CPRCompendiaSettings.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  /** @override */
  static PARTS = {
    form: {
      template:
        "systems/cyberpunk-red-core/templates/apps/compendia-settings.hbs",
    },
  };

  /**
   * When this application (read: form window) is launched, create the data object that is
   * consumed by the handle bars template to present options to the user. This populates
   * the select menu, and looks like this: {settingValue: humanReadableString}
   *
   * @async
   * @override
   * @param {Object} options (not used here)
   * @returns {Object}
   */
  // eslint-disable-next-line class-methods-use-this
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const critCurr = await game.settings.get(
      game.system.id,
      "criticalInjuryRollTableCompendium"
    );
    const netCurr = await game.settings.get(
      game.system.id,
      "netArchRollTableCompendium"
    );
    const dvCurr = await game.settings.get(
      game.system.id,
      "dvRollTableCompendium"
    );
    const choicesCrit = {
      [CPR.defaultCriticalInjuryTable]:
        "CPR.settings.criticalInjuryRollTableCompendium.default",
    };
    const choicesNet = {
      [CPR.defaultNetArchTable]:
        "CPR.settings.netArchRollTableCompendium.default",
    };
    const choicesDv = {
      [CPR.defaultDvTable]: "CPR.settings.dvRollTableCompendium.default",
    };
    const comps = SystemUtils.GetWorldCompendia("RollTable");
    for (const comp of comps) {
      choicesCrit[`world.${comp.metadata.name}`] = comp.metadata.label;
      choicesNet[`world.${comp.metadata.name}`] = comp.metadata.label;
      choicesDv[`world.${comp.metadata.name}`] = comp.metadata.label;
    }
    return {
      ...context,
      choicesCrit,
      choicesNet,
      choicesDv,
      critCurr,
      netCurr,
      dvCurr,
    };
  }

  /**
   * Called when the sub menu application (this thing) is submitted. Responsible for updating
   * internal settings with what the user chose.
   *
   * @async
   * @this {CPRCompendiaSettings}
   * @param {SubmitEvent} event (not used here)
   * @param {HTMLFormElement} form (not used here)
   * @param {FormDataExtended} formData - choices made with the dropdowns in the sub menus
   */
  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    await game.settings.set(
      game.system.id,
      "criticalInjuryRollTableCompendium",
      data.injuryChoice
    );
    await game.settings.set(
      game.system.id,
      "netArchRollTableCompendium",
      data.netArchChoice
    );
    await game.settings.set(
      game.system.id,
      "dvRollTableCompendium",
      data.dvChoice
    );
    SystemUtils.DisplayMessage(
      "notify",
      SystemUtils.Localize("CPR.settings.compendiumMenu.update")
    );
  }
}
