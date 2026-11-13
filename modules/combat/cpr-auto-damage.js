import * as CPRRolls from "../rolls/cpr-rolls.js";
import CPRChat from "../chat/cpr-chat.js";
import LOGGER from "../utils/cpr-logger.js";
import SystemUtils from "../utils/cpr-systemUtils.js";

const DAMAGEABLE_ACTOR_TYPES = ["character", "mook", "demon", "blackIce"];
// The values of CPRRolls.rollTypes for weapon attacks. They are spelled out so that
// nothing is read from another module while this one loads: it sits in an import cycle
// with the chat module.
const ATTACK_TYPES = ["attack", "aimed", "autofire"];
// What the Damage Application prompt offers, with everything left switched on.
const DEFAULT_DAMAGE_OPTIONS = {
  damageReductionRole: true,
  damageReductionAE: true,
  useShield: true,
  brainDamageReduction: true,
};

/**
 * Rolls a weapon's damage and applies it to the tokens an attack hit, without the
 * attacker having to press the damage and apply buttons.
 *
 * Players cannot modify actors they do not own, so damage to somebody else's token is
 * handed to the active GM's client over the system socket.
 */
export default class CPRAutoDamage {
  /** @returns {String} - the system socket event name */
  static get socketName() {
    return `system.${game.system.id}`;
  }

  /** @returns {Boolean} - whether hits apply their damage automatically */
  static get enabled() {
    return game.settings.get(game.system.id, "autoApplyDamage");
  }

  /**
   * Listen for damage that other clients ask the GM to apply.
   */
  static registerSocket() {
    game.socket.on(this.socketName, (message) => {
      if (message?.action !== "applyDamage") return;
      // Exactly one client acts on the request: the active GM.
      if (game.users.activeGM !== game.user) return;
      this.#applyLocally(message.target, message.damage).catch((err) =>
        LOGGER.error("Could not apply damage requested over the socket.", err)
      );
    });
  }

  /**
   * Describe what kind of attack a roll was, in the terms a damage roll understands.
   *
   * @param {CPRRoll} attackRoll
   * @returns {String} - one of ATTACK_TYPES
   */
  static attackTypeOf(attackRoll) {
    if (attackRoll instanceof CPRRolls.CPRAimedAttackRoll) {
      return CPRRolls.rollTypes.AIMED;
    }
    if (attackRoll instanceof CPRRolls.CPRAutofireRoll) {
      return CPRRolls.rollTypes.AUTOFIRE;
    }
    return CPRRolls.rollTypes.ATTACK;
  }

  /**
   * Roll damage for an attack and apply it to the targets it hit.
   *
   * Autofire multiplies its damage by the amount the attack beat the defence by, so
   * targets with different margins get their own roll; every other attack rolls once.
   *
   * @param {Object} attack
   * @param {CPRActor} attack.actor - the attacker
   * @param {String|null} attack.tokenId - the attacker's token id, if any
   * @param {CPRItem} attack.item - the weapon
   * @param {String} attack.attackType - one of ATTACK_TYPES
   * @param {String} attack.location - hit location of an Aimed Shot
   * @param {Object[]} targets - { actorId, tokenId, sceneId, margin } for each target hit
   */
  static async rollAndApply({ actor, tokenId, item, attackType, location }, targets) {
    if (!actor || !item || !Array.isArray(targets) || targets.length === 0) return;
    const type = ATTACK_TYPES.includes(attackType)
      ? attackType
      : CPRRolls.rollTypes.ATTACK;
    const isAutofire = type === CPRRolls.rollTypes.AUTOFIRE;

    const groups = new Map();
    for (const target of targets) {
      const margin = isAutofire ? Math.max(1, Math.floor(Number(target.margin) || 1)) : 1;
      if (!groups.has(margin)) groups.set(margin, []);
      groups.get(margin).push(target);
    }

    for (const [margin, group] of groups) {
      let cprRoll = item.createRoll(CPRRolls.rollTypes.DAMAGE, actor, {
        damageType: type,
      });
      if (!(cprRoll instanceof CPRRolls.CPRDamageRoll)) {
        LOGGER.warn(`${item.name} did not produce a damage roll; skipping.`);
        return;
      }
      if (cprRoll.isAimed && location) cprRoll.location = location;
      // The roll clamps the multiplier to the weapon's autofire maximum itself.
      if (isAutofire) cprRoll.autofireMultiplier = margin;

      // eslint-disable-next-line no-await-in-loop
      cprRoll = await item.confirmRoll(cprRoll);
      // eslint-disable-next-line no-await-in-loop
      await cprRoll.roll();

      cprRoll.entityData = {
        actor: actor.id,
        token: tokenId ?? null,
        item: item.id,
        // The damage card lists these so damage can be re-applied by hand if needed.
        tokens: group.map((target) => this.#findToken(target)).filter(Boolean),
      };
      // eslint-disable-next-line no-await-in-loop
      await CPRChat.RenderRollCard(cprRoll);

      const extra = cprRoll.rollCardExtraArgs ?? {};
      const damage = {
        total: Number(cprRoll.resultTotal) || 0,
        bonus: cprRoll.wasCritical() ? Number(cprRoll.bonusDamage) || 0 : 0,
        location: cprRoll.isAimed ? cprRoll.location : "body",
        ablation: Number(extra.ablationValue) || 0,
        ammoVariety: extra.ammoVariety,
        ignoreArmorPercent: Number(extra.ignoreArmorPercent) || 0,
        ignoreBelowSP: Number(extra.ignoreBelowSP) || 0,
        lethal: extra.ammoType !== "rubber",
        context: cprRoll.damageContext ?? {},
      };
      for (const target of group) {
        // eslint-disable-next-line no-await-in-loop
        await this.applyToTarget(target, damage);
      }
    }
  }

  /**
   * Apply rolled damage to one target, directly when this user may modify the target
   * and through the active GM otherwise.
   *
   * @param {Object} target - { actorId, tokenId, sceneId }
   * @param {Object} damage - see rollAndApply
   */
  static async applyToTarget(target, damage) {
    const actor = this.findActor(target);
    if (!actor) {
      SystemUtils.DisplayMessage(
        "warn",
        SystemUtils.Localize("CPR.chat.attackTargets.targetMissing")
      );
      return;
    }
    if (actor.isOwner) {
      await this.#applyLocally(target, damage);
      return;
    }
    if (!game.users.activeGM) {
      SystemUtils.DisplayMessage(
        "warn",
        SystemUtils.Localize("CPR.chat.attackTargets.noActiveGM")
      );
      return;
    }
    game.socket.emit(this.socketName, { action: "applyDamage", target, damage });
  }

  /**
   * Apply damage on this client. Armor, ablation, damage reduction and the Damage
   * Application chat card are all handled by the actor.
   *
   * @param {Object} target - { actorId, tokenId, sceneId }
   * @param {Object} damage - see rollAndApply
   */
  static async #applyLocally(target, damage) {
    const actor = this.findActor(target);
    if (!actor || !DAMAGEABLE_ACTOR_TYPES.includes(actor.type)) return;
    const location = ["head", "brain"].includes(damage?.location)
      ? damage.location
      : "body";
    // eslint-disable-next-line no-underscore-dangle
    await actor._applyDamage(
      Number(damage?.total) || 0,
      Number(damage?.bonus) || 0,
      location,
      Number(damage?.ablation) || 0,
      damage?.ammoVariety,
      Number(damage?.ignoreArmorPercent) || 0,
      Number(damage?.ignoreBelowSP) || 0,
      damage?.lethal !== false,
      { ...DEFAULT_DAMAGE_OPTIONS },
      damage?.context ?? {}
    );
  }

  /**
   * @param {Object} target - { tokenId, sceneId }
   * @returns {TokenDocument|null}
   */
  static #findTokenDocument(target) {
    if (!target?.tokenId) return null;
    const scene = game.scenes.get(target.sceneId) ?? canvas?.scene;
    return scene?.tokens?.get(target.tokenId) ?? null;
  }

  /**
   * @param {Object} target - { tokenId, sceneId }
   * @returns {Token|null} - the placeable, when its scene is the one being viewed
   */
  static #findToken(target) {
    return this.#findTokenDocument(target)?.object ?? null;
  }

  /**
   * Resolve a target to its actor, preferring the token's own (possibly unlinked) actor.
   *
   * @param {Object} target - { actorId, tokenId, sceneId }
   * @returns {CPRActor|null}
   */
  static findActor(target) {
    return (
      this.#findTokenDocument(target)?.actor ??
      game.actors.get(target?.actorId) ??
      null
    );
  }
}
