import SystemUtils from "./cpr-systemUtils.js";

/**
 * Sets up a ContextMenu that appears when the provided selector is right clicked.
 * The ContextMenu contains a menu item that enables the user to share an image with other players.
 * @param {Object} html - The DOM object
 * @param {string} contextMenuTargetSelector - The selector for the element that will open the ContextMenu when right clicked
 * @param {{name: string, img: string}} data - The created ContextMenu
 */
export default function createImageContextMenu(
  html,
  contextMenuTargetSelector,
  data
) {
  const menuItems = [
    {
      name: SystemUtils.Format("CPR.sheets.image.showPlayers"),
      icon: '<i class="fas fa-eye"></i>',
      callback: () => {
        const popout = new foundry.applications.apps.ImagePopout({
          src: data.img,
          window: { title: data.name },
          shareable: true,
        });
        popout.render(true);
        popout.shareImage(true);
      },
    },
  ];
  const element = html instanceof HTMLElement ? html : html?.[0];
  if (!(element instanceof HTMLElement)) {
    throw new TypeError("Image context menu requires an HTMLElement root.");
  }

  return new foundry.applications.ux.ContextMenu.implementation(
    element,
    contextMenuTargetSelector,
    menuItems,
    { jQuery: false }
  );
}
