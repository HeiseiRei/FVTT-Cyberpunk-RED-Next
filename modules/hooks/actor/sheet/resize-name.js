import SheetUtils from "../../../utils/SheetUtils.js";

const ResizeName = () => {
  /**
   * Resizes the font size of the 'name' input field to accommodate long names
   * without text overflow. This is done by calling `SheetUtils.adjustFontSizeToFit`
   * on the 'input[name="name"]' element.
   *
   * @public
   * @memberof hookEvents
   * @param {CPRActorSheet} app - application object (unused)
   * @param {Object} html - HTML DOM object
   */
  // Every CPR Actor Sheet is an AppV2 application. The hook is limited to Actor sheets,
  // as the AppV1 "renderActorSheet" hook it replaces was.
  Hooks.on("renderApplicationV2", (app) => {
    if (!(app.document instanceof Actor)) return;
    const inputElement = app.element?.querySelector('input[name="name"]');
    if (inputElement) {
      window.requestAnimationFrame(() => {
        SheetUtils.adjustFontSizeToFit($(inputElement));
      });
    }
  });
};

export default ResizeName;
