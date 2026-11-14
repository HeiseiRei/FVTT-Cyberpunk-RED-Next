import CPRAutoDamage from "../../combat/cpr-auto-damage.js";

const AutoDamageSocket = () => {
  /**
   * Players cannot modify actors they do not own. When one of their attacks damages
   * such an actor, the request travels over the system socket and the active GM's
   * client applies it.
   *
   * @public
   * @memberof hookEvents
   */
  if (game.ready) CPRAutoDamage.registerSocket();
  else Hooks.once("ready", () => CPRAutoDamage.registerSocket());
};

export default AutoDamageSocket;
