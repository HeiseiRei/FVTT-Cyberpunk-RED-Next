const DERIVED_TRIGGERS = {
  hp: ["system.stats.body.value", "system.stats.will.value"],
  humanityMax: ["system.stats.emp.max"],
  humanityValue: ["system.derivedStats.humanity.value"],
};

const AutoDerivedStats = () => {
  /**
   * Keep a character's derived stats in step with the stats they are calculated from,
   * so nobody has to press the calculator buttons after editing a sheet:
   *
   *  - BODY or WILL changes: max HP is recalculated. If the character was at full HP
   *    they stay at full HP, otherwise current HP is only capped to the new maximum.
   *  - Max EMP changes: max Humanity is recalculated (10 x EMP minus the Humanity
   *    lost to installed cyberware). Current Humanity follows the same full/capped
   *    rule, and current EMP is set to a tenth of current Humanity.
   *  - Current Humanity changes: current EMP is set to a tenth of it, rounded down.
   *
   * Only Characters are affected; Mooks take their HP from a stat block. The world
   * setting "autoCalculateDerivedStats" turns the behaviour off.
   *
   * @public
   * @memberof hookEvents
   * @param {CPRActor} actor  - the Actor that was updated
   * @param {object} changes  - the differential update that was applied
   * @param {object} options  - update options
   * @param {string} userId   - the User who made the update
   */
  Hooks.on("updateActor", async (actor, changes, options, userId) => {
    // Only the client that made the change follows up, so the update happens once.
    if (userId !== game.user.id) return;
    if (actor.type !== "character") return;
    if (!game.settings.get(game.system.id, "autoCalculateDerivedStats")) return;

    const changed = (paths) =>
      paths.some((path) => foundry.utils.hasProperty(changes, path));
    const update = {};
    const { derivedStats } = actor.system;

    if (changed(DERIVED_TRIGGERS.hp)) {
      const { hp } = derivedStats;
      const maxHp = actor.calcMaxHp();
      if (Number.isFinite(maxHp) && maxHp !== hp.max) {
        update["system.derivedStats.hp.max"] = maxHp;
        const value = hp.value >= hp.max ? maxHp : Math.min(hp.value, maxHp);
        if (value !== hp.value) update["system.derivedStats.hp.value"] = value;
      }
    }

    let humanityValue = derivedStats.humanity.value;
    if (changed(DERIVED_TRIGGERS.humanityMax)) {
      const { humanity } = derivedStats;
      // eslint-disable-next-line no-underscore-dangle
      const maxHumanity = actor._calcMaxHumanity();
      if (Number.isFinite(maxHumanity) && maxHumanity !== humanity.max) {
        update["system.derivedStats.humanity.max"] = maxHumanity;
        humanityValue =
          humanity.value >= humanity.max
            ? maxHumanity
            : Math.min(humanity.value, maxHumanity);
        if (humanityValue !== humanity.value) {
          update["system.derivedStats.humanity.value"] = humanityValue;
        }
      }
    }

    if (
      changed(DERIVED_TRIGGERS.humanityValue) ||
      "system.derivedStats.humanity.value" in update
    ) {
      const empathy = Math.max(0, Math.floor(Number(humanityValue) / 10));
      if (Number.isFinite(empathy) && empathy !== actor.system.stats.emp.value) {
        update["system.stats.emp.value"] = empathy;
      }
    }

    if (Object.keys(update).length > 0) await actor.update(update);
  });
};

export default AutoDerivedStats;
