import CPRActorSheet from "./cpr-actor-sheet.js";
import LOGGER from "../../utils/cpr-logger.js";
import SystemUtils from "../../utils/cpr-systemUtils.js";
import CPRDialog from "../../dialog/cpr-dialog-application.js";

/**
 * Extend the basic CPRActorSheet. A lot of code is common between mooks and characters.
 *
 * The point of a mook sheet is to provide a more "at-a-glance" view of a disposable NPC.
 * If the GM or players need a more indepth view of an actor's skills, inventories, and
 * cyberware, they should use the character sheet instead.
 *
 * @extends {CPRActorSheet}
 */
export default class CPRMookActorSheet extends CPRActorSheet {
  /** Lets other code identify this sheet without importing the class. */
  isCPRMookActorSheet = true;

  static DEFAULT_OPTIONS = {
    classes: ["cpr-mook-sheet-v2"],
    position: { width: 800 },
    window: { icon: "fa-solid fa-user-ninja", resizable: true },
  };

  /** Starting height used when the "resizeCPRSheets" setting is enabled. */
  static CPR_RESIZED_HEIGHT = 600;

  static PARTS = {
    sheet: {
      template:
        "systems/cyberpunk-red-core/templates/actor/cpr-mook-sheet.hbs",
      scrollable: [""],
    },
  };

  /**
   * Mooks have a separate template when a user only has a "limited" permission level for it.
   * This is how details are obscured from those players, we simply do not render them.
   * Yes, they can still find this information in game.actors and the Foundry development
   * community does not really view this as a problem.
   *
   * https://discord.com/channels/170995199584108546/596076404618166434/864673619098730506
   *
   * @override
   * @returns {Object} - the template parts to render
   */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (this._isLimitedView) {
      parts.sheet.template = `systems/${game.system.id}/templates/actor/cpr-mook-sheet-limited.hbs`;
    }
    return parts;
  }

  /**
   * Is the current user restricted to the limited view of this mook?
   *
   * @returns {Boolean}
   */
  get _isLimitedView() {
    return !game.user.isGM && this.actor.limited;
  }

  /**
   * The Mook sheet goes a little further than the common context by tracking whether any armor
   * or weapons (including cyberware weapons) are equipped on the mook.
   *
   * @override
   * @returns {Object} context - a curated structure of actorSheet data
   */
  async _prepareContext(options) {
    const foundryData = await super._prepareContext(options);
    const cprActorData = foundryData.actor.system;
    cprActorData.equippedArmor = this.actor.itemTypes.armor.filter(
      (item) => item.system.equipped === "equipped"
    );
    cprActorData.equippedWeapons = this.actor.itemTypes.weapon.filter(
      (item) => item.system.equipped === "equipped"
    );

    const installedCyberware = this.actor.itemTypes.cyberware.filter(
      (cw) => cw.system.isInstalled
    );
    const installedWeapons = installedCyberware.filter(
      (c) => c.system.isWeapon === true
    );
    cprActorData.equippedWeapons =
      cprActorData.equippedWeapons.concat(installedWeapons);
    foundryData.data.system = cprActorData;
    return foundryData;
  }

  /**
   * Activate listeners for the sheet. The listeners that are common between mooks and
   * characters are activated by the parent class.
   *
   * @override
   */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this._activateMookListeners($(this.element));
  }

  /**
   * @param {jQuery} html - the application element
   */
  _activateMookListeners(html) {
    html.find(".mod-mook-skill").click(() => this._modMookSkills());
    html.find(".change-mook-name").click(() => this._changeMookName());
    html
      .find(".mook-image-toggle")
      .click((event) => this._expandMookImage(event));

    // If the element is "changeable", check for a keydown action and handle the key press.
    html.find(".changeable").hover((event) => $(event.currentTarget).focus());
    html.find(".changeable").keydown((event) => this._handleKeyPress(event));

    // If the element is "installable", await mouse click and process the event
    html
      .find(".installable")
      .click((event) => this._handleInstallAction(event));
  }

  /**
   * Called when the edit-skills glyph (top right of the skills section on the sheet) is clicked. This
   * pops up the wizard for modifying mook skills quickly. The form data is then parsed for values that
   * are different from what is current on the mook's skill objects. Those are the updates we send
   * along.
   *
   * @async
   * @callback
   * @private
   * @returns null
   */
  async _modMookSkills() {
    const skillObj = {};

    const sortedArray = SystemUtils.SortItemListByName(
      this.actor.itemTypes.skill
    );
    sortedArray.forEach((s) => {
      const skillRef = {
        id: s.id,
        name: s.name,
        level: s.system.level,
        stat: this.actor.system.stats[s.system.stat].value,
        mod: this.actor.bonuses[
          SystemUtils.slugify(SystemUtils.GetOriginalName(s))
        ],
      };
      skillObj[s.id] = skillRef;
    });

    // Pop up the form with embedded skill details.
    const formData = await CPRDialog.showDialog(
      foundry.utils.duplicate(skillObj),
      {
        title: "CPR.mookSheet.dialog.modSkillTitle",
        template: `systems/${game.system.id}/templates/dialog/cpr-mod-mook-skill-prompt.hbs`,
      }
    ).catch((err) => LOGGER.debug(err));
    if (formData === undefined) {
      return;
    }

    // go over each skill and see if the value differs from the skill objects on the mook (actor)
    const updatedSkills = [];
    for (const oldSkill of Object.values(skillObj)) {
      const newSkill = formData[oldSkill.id];
      if (oldSkill.level !== newSkill.level) {
        LOGGER.debug(
          `you changed ${oldSkill.name} from ${oldSkill.level} to ${newSkill.level}`
        );
        const [updatedSkill] = this.actor.itemTypes.skill.filter(
          (skill) => skill.id === oldSkill.id
        );
        updatedSkill.setSkillLevel(newSkill.level);
        updatedSkills.push({
          _id: updatedSkill._id,
          system: {
            level: updatedSkill.system.level,
          },
        });
      }
    }
    if (!updatedSkills.length) return;

    // finally, update the skill objects
    this.actor.updateEmbeddedDocuments("Item", updatedSkills);
    SystemUtils.DisplayMessage(
      "notify",
      `${updatedSkills.length} ${SystemUtils.Localize(
        "CPR.mookSheet.skills.updated"
      )}`
    );
  }

  /**
   * Called when a user clicks on the mook name in the sheet. Pops up a dialog to edit the name.
   *
   * @async
   * @callback
   * @private
   * @returns null
   */
  async _changeMookName() {
    // Show "Mook Name" dialog.
    const dialogData = await CPRDialog.showDialog(
      { name: this.actor.name },
      // Set the options for the dialog.
      {
        title: SystemUtils.Localize("CPR.mookSheet.dialog.modNameTitle"),
        template: `systems/${game.system.id}/templates/dialog/cpr-mook-name-prompt.hbs`,
      }
    ).catch((err) => LOGGER.debug(err));
    if (dialogData === undefined) {
      return;
    }
    if (!this.isToken) {
      await this.actor.update(dialogData);
    } else {
      await this.token.update(dialogData);
    }
  }

  /**
   * Show or hide the profile icon on the mook sheet when clicked.
   *
   * @callback
   * @private
   * @param {Object} event - event data such as a mouse click or key press
   */
  _expandMookImage(event) {
    const mookImageArea = $(event.currentTarget).parents(".mook-image");
    const mookImageImg = $(event.currentTarget)
      .parents(".mook-image")
      .children(".mook-image-block");
    const mookImageToggle = $(event.currentTarget);
    let collapsedImage = null;
    if (
      mookImageToggle.attr("data-text") ===
      SystemUtils.Localize("CPR.mookSheet.image.collapse")
    ) {
      mookImageToggle.attr(
        "data-text",
        SystemUtils.Localize("CPR.mookSheet.image.expand")
      );
      collapsedImage = true;
    } else {
      mookImageToggle.attr(
        "data-text",
        SystemUtils.Localize("CPR.mookSheet.image.collapse")
      );
      collapsedImage = false;
    }
    mookImageArea.toggleClass("mook-image-small-toggle");
    mookImageImg.toggleClass("hide");
    const cprActorData = foundry.utils.duplicate(this.actor.system);
    cprActorData.flags.collapsedImage = collapsedImage;
    this.actor.update(cprActorData);
  }

  /**
   * Called when a user presses a key, but only does things if it was DEL. This is used in conjunction
   * with jQuery's focus() call, which is called on hover. That way, an html element is "selected" just
   * by hovering the mouse over. Then when DEL is pressed, we have a thing that can be deleted from the sheet
   * and the actor object underneath.
   *
   * @async
   * @callback
   * @private
   * @param {Object} event - event data such as a mouse click or key press
   */
  async _handleKeyPress(event) {
    LOGGER.debug(event.keyCode);
    if (event.keyCode === 46) {
      LOGGER.debug("DEL key was pressed");
      const itemId = SystemUtils.GetEventDatum(event, "data-item-id");
      const item = this.actor.getOwnedItem(itemId);
      switch (item.type) {
        case "skill": {
          item.setSkillLevel(0);
          this._updateOwnedItem(item);
          break;
        }
        case "cyberware": {
          if (item.system.core === true) {
            SystemUtils.DisplayMessage(
              "error",
              SystemUtils.Localize("CPR.messages.cannotDeleteCoreCyberware")
            );
          } else {
            const foundationalId = SystemUtils.GetEventDatum(
              event,
              "data-foundational-id"
            );
            const dialogTitle = SystemUtils.Localize(
              "CPR.dialog.removeCyberware.title"
            );
            const dialogMessage = `${SystemUtils.Localize(
              "CPR.dialog.removeCyberware.text"
            )} ${item.name}?`;

            // Show "Default" dialog.
            const confirmRemove = await CPRDialog.showDialog(
              { dialogMessage },
              // Set the options for the dialog.
              { title: dialogTitle }
            ).catch((err) => LOGGER.debug(err));
            if (!confirmRemove) return;

            await this.actor.uninstallCyberware(itemId, foundationalId, true);
            this._deleteOwnedItem(item, true);
          }
          break;
        }
        default: {
          this._deleteOwnedItem(item);
          break;
        }
      }
    } else if (event.keyCode === 18) {
      LOGGER.debug("ALT key was pressed");
      $(".skill-name").hide();
    }
  }

  /**
   * Called when a user clicks their mouse on an element with "installable" class.
   *
   * @async
   * @callback
   * @private
   * @param {Object} event - event data such as a mouse click or key press
   */
  async _handleInstallAction(event) {
    const itemId = SystemUtils.GetEventDatum(event, "data-item-id");
    const item = this.actor.getOwnedItem(itemId);
    if (event.shiftKey) {
      if (item.type === "cyberware") {
        if (item.system.core === true) {
          SystemUtils.DisplayMessage(
            "error",
            SystemUtils.Localize("CPR.messages.cannotDeleteCoreCyberware")
          );
        } else if (item.system.isInstalled === false) {
          await this.actor.installCyberware(itemId);
        } else {
          const foundationalId = SystemUtils.GetEventDatum(
            event,
            "data-foundational-id"
          );
          const dialogTitle = SystemUtils.Localize(
            "CPR.dialog.removeCyberware.title"
          );
          const dialogMessage = `${SystemUtils.Localize(
            "CPR.dialog.removeCyberware.text"
          )} ${item.name}?`;

          // Show "Default" dialog.
          const confirmRemove = await CPRDialog.showDialog(
            { dialogMessage },
            // Set the options for the dialog.
            { title: dialogTitle }
          ).catch((err) => LOGGER.debug(err));
          if (!confirmRemove) return;

          await this.actor.uninstallCyberware(itemId, foundationalId, true);
        }
      }
    }
  }
}
