import SystemUtils from "../utils/cpr-systemUtils.js";

const { DialogV2 } = foundry.applications.api;

export default class LedgerEditPrompt {
  /**
   * Ask how a ledger should change.
   *
   * @param {String} title - localization key (or text) of the window title
   * @returns {Promise<Object>} - resolves with the form data, rejects if the prompt is cancelled or closed
   */
  static async RenderPrompt(title) {
    const content = await foundry.applications.handlebars.renderTemplate(
      `systems/${game.system.id}/templates/dialog/cpr-ledger-edit-prompt.hbs`
    );
    const formData = await DialogV2.wait({
      window: { title: SystemUtils.Localize(title) },
      classes: ["cpr-nd-dialog"],
      content,
      rejectClose: false,
      buttons: [
        {
          action: "confirm",
          icon: "fas fa-check",
          label: SystemUtils.Localize("CPR.dialog.common.confirm"),
          default: true,
          callback: (event, button) => {
            const fd = new foundry.applications.ux.FormDataExtended(button.form);
            return foundry.utils.expandObject(fd.object);
          },
        },
        {
          action: "cancel",
          icon: "fas fa-xmark",
          label: SystemUtils.Localize("CPR.dialog.common.cancel"),
        },
      ],
    });
    // Cancelling resolves with the button's action name and closing with null; only
    // the confirm button produces form data.
    if (formData === null || typeof formData !== "object") {
      throw new Error("Promise rejected: Window Closed");
    }
    return formData;
  }
}
