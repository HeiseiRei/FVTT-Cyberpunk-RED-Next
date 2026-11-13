import SystemUtils from "../utils/cpr-systemUtils.js";
import { measureDistance, resolveWeaponDv } from "../system/distance-dv.js";

const ACTOR_TYPES_WITH_EVASION = ["character", "mook"];
// A character needs REF 8 or higher to dodge a Ranged Attack (core rules, "Evasion").
const RANGED_EVASION_MIN_REF = 8;

/**
 * Resolves weapon attacks against the tokens the attacker has targeted, so the attack
 * roll card can say who was hit and offer the defender an Evasion roll.
 */
export default class CPRTargeting {
  /**
   * Find the token an actor is attacking from.
   *
   * @param {CPRActor} actor - the attacker
   * @param {TokenDocument|null} sheetToken - the token document the roll was made from, if any
   * @returns {Token|null} - the placeable token on the viewed scene
   */
  static getAttackerToken(actor, sheetToken = null) {
    if (!canvas?.ready) return null;
    if (sheetToken?.object) return sheetToken.object;

    const actorTokens = canvas.tokens.placeables.filter(
      (token) => token.actor === actor
    );
    const controlled = canvas.tokens.controlled.filter(
      (token) => token.actor === actor
    );
    if (controlled.length === 1) return controlled[0];
    return actorTokens.length === 1 ? actorTokens[0] : null;
  }

  /**
   * Work out the result of an attack roll against every targeted token.
   *
   * Ranged Attacks are compared to the DV of the weapon at the measured distance; the
   * attack must beat the DV. Melee Attacks have no DV: they are resolved by the
   * defender's Evasion roll, as are Ranged Attacks against a defender quick enough to
   * dodge who chooses to do so.
   *
   * @param {CPRRoll} cprRoll - the attack roll, already rolled
   * @param {CPRActor} actor - the attacker
   * @param {CPRItem} weapon - the weapon (or item with a weapon profile) being used
   * @param {Token[]} targets - the tokens the attacker has targeted
   * @param {TokenDocument|null} sheetToken - the token document the roll was made from
   * @returns {Promise<Object[]>} - one entry per target, for the roll card
   */
  static async evaluateAttack(cprRoll, actor, weapon, targets, sheetToken = null) {
    if (!Array.isArray(targets) || targets.length === 0) return [];

    const attacker = this.getAttackerToken(actor, sheetToken);
    const isRanged = Boolean(weapon?.system?.isRanged);
    const total = Number(cprRoll.resultTotal);

    const results = [];
    for (const target of targets) {
      if (!target?.actor || target === attacker) continue;

      const result = {
        name: target.name,
        tokenId: target.id,
        actorId: target.actor.id,
        sceneId: target.document?.parent?.id ?? "",
        isRanged,
        distance: null,
        units: canvas.scene?.grid?.units ?? "",
        dv: null,
        outOfRange: false,
        hit: null,
        // How far the attack beat the DV by; Autofire multiplies its damage by this.
        margin: 1,
        canEvade: this.#canEvade(target.actor, isRanged),
      };

      if (attacker) {
        const { distance } = measureDistance(attacker, target);
        result.distance = Math.round(distance * 10) / 10;

        if (isRanged) {
          // eslint-disable-next-line no-await-in-loop
          const dvResult = await resolveWeaponDv(actor, weapon, distance);
          if (dvResult?.outOfRange) {
            result.outOfRange = true;
            result.hit = false;
          } else if (Number.isFinite(dvResult?.dv)) {
            result.dv = dvResult.dv;
            // The attack has to beat the DV; a tie is a miss.
            result.hit = total > dvResult.dv;
            result.margin = Math.max(1, total - dvResult.dv);
          }
        }
      }

      results.push(result);
    }
    return results;
  }

  /**
   * Can this actor answer an attack with an Evasion roll?
   *
   * @param {CPRActor} actor - the defender
   * @param {Boolean} isRanged - whether the attack is a Ranged Attack
   * @returns {Boolean}
   */
  static #canEvade(actor, isRanged) {
    if (!ACTOR_TYPES_WITH_EVASION.includes(actor.type)) return false;
    if (!isRanged) return true;
    const ref = Number(actor.system?.stats?.ref?.value);
    return Number.isFinite(ref) && ref >= RANGED_EVASION_MIN_REF;
  }

  /**
   * Find the Evasion skill on an actor, whatever language its name is shown in.
   *
   * @param {CPRActor} actor
   * @returns {CPRItem|undefined}
   */
  static getEvasionSkill(actor) {
    return actor.itemTypes.skill.find(
      (skill) =>
        SystemUtils.slugify(SystemUtils.GetOriginalName(skill)) === "evasion"
    );
  }

  /**
   * Describe how a defender's Evasion roll fared against an attack. The defender wins
   * ties: the attacker has to beat the Evasion roll.
   *
   * @param {Number} evasionTotal - the defender's roll
   * @param {Number} attackTotal - the attacker's roll
   * @param {String} attackerName - who made the attack
   * @returns {Object} - data for the skill roll card
   */
  static describeDefense(evasionTotal, attackTotal, attackerName) {
    return {
      attackTotal,
      attackerName,
      evaded: Number(evasionTotal) >= Number(attackTotal),
    };
  }
}
