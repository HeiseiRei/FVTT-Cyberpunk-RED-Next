/* eslint-disable max-classes-per-file */
/* eslint-disable no-shadow */
import SystemUtils from "../utils/cpr-systemUtils.js";
import CPRDialog from "./cpr-dialog-application.js";

export default class SelectRoleBonuses extends CPRDialog {
  /**
   * dialogData.roleData will either contain roleItem.system or roleItem.system.someSubAbility.
   *
   * @param {Object} dialogData - Data for the form. Includes a skill list and information from the role.
   * @constructor
   */
  constructor(dialogData, options) {
    super(dialogData, options);
    this.skillList = dialogData.skillList;
    this.roleData = dialogData.roleData;
    this.dialogOptions.template = `systems/${game.system.id}/templates/dialog/cpr-select-role-bonuses-prompt.hbs`;
    this.dialogOptions.title = SystemUtils.Localize(
      "CPR.dialog.selectRoleBonuses.title"
    );
  }

  /**
   * Prepares data for roll dialog sheet.
   *
   * @override
   */
  async _prepareContext(options) {
    const data = await super._prepareContext(options);
    data.skillList = this.skillList;
    data.roleData = this.roleData;
    return data;
  }

  /**
   * Processes the form's data in a way that is useful to us.
   *
   * @param {*} event - currently not used.
   * @param {Object} formData - Data from the submitted form.
   * @param {Object} [options]
   * @param {Boolean} [options.render=true] - re-render the dialog with the new data
   * @override
   */
  async _updateDialogData(event, formData, { render = true } = {}) {
    // Convert selected skills into a neat list.
    const bonuses = [];
    [formData.selectedSkills ?? []].flat().forEach((s) => {
      if (s) bonuses.push(this.skillList.find((a) => a.name === s));
    });

    // Make sure that we are not dividing by 0 or null/undefined.
    const bonusRatio =
      !formData.bonusRatio || formData.bonusRatio === 0
        ? 1
        : formData.bonusRatio;

    // Collect relevant data into one object.
    const updatedData = {
      bonusRatio,
      bonuses,
      universalBonuses: [formData.universalBonuses ?? []].flat().filter((b) => b),
    };

    // Merge above object with our original data.
    // This is then used to update the role item in item-sheet.js (_selectRoleBonuses)
    foundry.utils.mergeObject(this.object.roleData, updatedData);
    if (render) this.render(); // rerenders the dialog with the new data.
  }
}
