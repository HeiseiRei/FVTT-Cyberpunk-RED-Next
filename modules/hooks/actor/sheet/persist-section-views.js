import SystemUtils from "../../../utils/cpr-systemUtils.js";

const PersistSectionViews = () => {
  /**
   * Persist collapsed sections of a character when it is closed. That way they
   * are not lost when it is re-opened.
   *
   * @public
   * @memberof hookEvents
   * @param {CPRActorSheet} actorSheet - application object (the sheet)
   */
  const persistSectionViews = (actorSheet) => {
    const { collapsedSections } = actorSheet;
    if (!collapsedSections) return;
    SystemUtils.SetUserSetting(
      "sheetConfig",
      "sheetCollapsedSections",
      collapsedSections,
      actorSheet.id
    );
  };
  // Every CPR Actor Sheet is an AppV2 application.
  Hooks.on("closeApplicationV2", persistSectionViews);
};

export default PersistSectionViews;
