import SheetUtils from "../../../utils/SheetUtils.js";

const ResizeTypeTag = () => {
  /**
   * Adjusts the width of elements with the '.type-tag' class dynamically.
   *
   * @public
   * @memberof hookEvents
   * @param {CPRActorSheet} app - application object (unused)
   * @param {Object} html - HTML DOM object
   */
  // Every CPR Actor Sheet is an AppV2 application, so one hook covers them all.
  Hooks.on("renderApplicationV2", (app) => {
    if (!app.element?.querySelector(".type-tag")) return;
    window.requestAnimationFrame(() => {
      SheetUtils.setCssClassWidth($(app.element), ".type-tag");
    });
  });
  // Item Sheets are AppV2 applications (CPRItemSheet), so the renderApplicationV2
  // hook above covers them as well.
};

export default ResizeTypeTag;
