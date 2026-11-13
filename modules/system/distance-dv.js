import SystemUtils from "/systems/cyberpunk-red-core/modules/utils/cpr-systemUtils.js";

const SYSTEM_ID = "cyberpunk-red-core";
const WEAPON_CARDS = ".weapon-grid[data-item-id], .cprx-weapon[data-item-id]";

const activeWeaponIds = new Map();
let altHeld = false;
let overlay;
let line;
let labelBackground;
let label;
let dvTablesPromise;
let tableErrorReported = false;
let canvasView;
const attackButtonRequests = new WeakMap();

function localize(key, data) {
  return game.i18n.format(key, data);
}

function getRoot(html) {
  return html instanceof HTMLElement ? html : html?.[0];
}

function getWeaponSelectorLabel(card) {
  return card.classList.contains("cpr-nd-weapon") || card.classList.contains("cpr3a-weapon")
    ? "peek"
    : game.i18n.localize("CPR.distanceDV.weapon.use");
}

function getEligibleWeapon(actor, itemId) {
  if (!["character", "mook"].includes(actor?.type)) return null;
  const weapon = actor.items.get(itemId);
  if (!weapon?.system?.isRanged || !weapon.system.dvTable) return null;
  const equippedIds = new Set(
    (actor.system.weapons?.equipped ?? []).map((item) => item.id)
  );
  return equippedIds.has(weapon.id) ? weapon : null;
}

function getActiveWeapon(actor) {
  if (!["character", "mook"].includes(actor?.type)) return null;

  const selected = getEligibleWeapon(
    actor,
    activeWeaponIds.get(actor.uuid)
  );
  if (selected) return selected;

  const weapons = (actor.system.weapons?.equipped ?? [])
    .map(({ id }) => getEligibleWeapon(actor, id))
    .filter(Boolean);
  return weapons.length === 1 ? weapons[0] : null;
}

function getSheetAttackSituation(actor) {
  if (!canvas.ready || !canvas.tokens.active) return null;

  const actorTokens = canvas.tokens.placeables.filter(
    (token) => token.actor === actor
  );
  const controlledActorTokens = canvas.tokens.controlled.filter(
    (token) => token.actor === actor
  );
  const shooter = controlledActorTokens.length === 1
    ? controlledActorTokens[0]
    : actorTokens.length === 1
      ? actorTokens[0]
      : null;
  if (!shooter) return null;

  const targets = [...game.user.targets].filter(
    (token) =>
      token !== shooter &&
      token.document.parent?.id === canvas.scene.id
  );
  if (targets.length !== 1) return null;

  return { shooter, target: targets[0] };
}

function setAttackButtonLabel(button, text) {
  const label = button.querySelector(".cpr-nd-attack-label, .cpr3a-attack-label");
  if (!label) return;
  label.textContent = text;
}

function updateAttackButton(button, actor) {
  const label = button.querySelector(".cpr-nd-attack-label, .cpr3a-attack-label");
  if (!label) return;

  const defaultLabel = label.dataset.defaultLabel ?? label.textContent;
  const requestId = (attackButtonRequests.get(button) ?? 0) + 1;
  attackButtonRequests.set(button, requestId);

  const situation = getSheetAttackSituation(actor);
  const weapon = getEligibleWeapon(actor, button.dataset.itemId);
  if (!situation || !weapon) {
    setAttackButtonLabel(button, defaultLabel);
    return;
  }

  const distance = measureDistance(situation.shooter, situation.target).distance;
  resolveWeaponDv(actor, weapon, distance)
    .then((result) => {
      if (
        attackButtonRequests.get(button) !== requestId ||
        !button.isConnected
      ) {
        return;
      }

      let text = defaultLabel;
      if (result?.outOfRange) {
        text = game.i18n.localize("CPR.distanceDV.line.outOfRange");
      } else if (result?.dv !== null && result?.dv !== undefined) {
        text = localize("CPR.distanceDV.button.dc", { dv: result.dv });
      }

      const applyResult = () => {
        if (
          attackButtonRequests.get(button) !== requestId ||
          !button.isConnected
        ) {
          return;
        }

        const current = getSheetAttackSituation(actor);
        if (
          !current ||
          current.shooter !== situation.shooter ||
          current.target !== situation.target ||
          measureDistance(current.shooter, current.target).distance !== distance
        ) {
          return;
        }

        setAttackButtonLabel(button, text);
      };

      if (result?.outOfRange) {
        setTimeout(applyResult, 150);
      } else {
        applyResult();
      }
    })
    .catch(reportRangeDifficultyError);
}

function updateAttackButtons(actor, root) {
  for (const button of root.querySelectorAll(
    '.cpr-nd-weapon [data-cpr-nd-action="roll-weapon"], .cpr3a-weapon [data-cpr3a-action="roll-weapon"]'
  )) {
    updateAttackButton(button, actor);
  }
}

function refreshOpenAttackButtons() {
  if (!game.actors) return;

  for (const actor of game.actors.contents) {
    if (!["character", "mook"].includes(actor.type) || !actor.sheet?.rendered) {
      continue;
    }

    const root = getRoot(actor.sheet.element);
    if (root) updateAttackButtons(actor, root);
  }
}

function setWeaponButtonState(button, isActive, card) {
  button.classList.toggle("is-active", isActive);
  button.setAttribute("aria-pressed", String(isActive));
  const label = getWeaponSelectorLabel(card);
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = `<i class="far fa-${isActive ? "circle-dot" : "circle"} text-padding-right-smallest"></i>`;
}

function addWeaponSelectors(app, html) {
  const actor = app.actor ?? app.document;
  const root = getRoot(html);
  if (!root || !["character", "mook"].includes(actor?.type)) return;

  updateAttackButtons(actor, root);

  if (!actor.isOwner || game.system.id !== SYSTEM_ID) {
    return;
  }

  for (const card of root.querySelectorAll(WEAPON_CARDS)) {
    const itemId = card.dataset.itemId;
    if (!getEligibleWeapon(actor, itemId)) continue;

    const aimedMode = card.querySelector(
      '.weapon-mode [data-fire-mode="aimed"]'
    );
    const weaponModeList = aimedMode?.closest("ul");
    const aimedModeRow = aimedMode?.closest("li");
    if (!weaponModeList || !aimedModeRow) continue;

    let button = card.querySelector(".cpr-distance-dv-select");
    let buttonRow = button?.closest("li");
    if (button && buttonRow?.parentElement !== weaponModeList) {
      buttonRow?.remove();
      button.remove();
      button = null;
    }
    if (!button) {
      buttonRow = document.createElement("li");
      const label = document.createElement("span");
      label.className = "text-padding-sides-small";
      label.textContent = getWeaponSelectorLabel(card);
      button = document.createElement("a");
      button.className = "cpr-distance-dv-select";
      button.setAttribute("role", "button");
      button.tabIndex = 0;
      button.dataset.itemId = itemId;
      buttonRow.append(label, button);
      aimedModeRow.after(buttonRow);
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const selected = activeWeaponIds.get(actor.uuid);
        if (selected === itemId) activeWeaponIds.delete(actor.uuid);
        else activeWeaponIds.set(actor.uuid, itemId);
        app.render(false);
        refreshOnEvent();
      });
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          button.click();
        }
      });
    } else {
      const label = buttonRow.querySelector("span");
      if (label) {
        label.textContent = getWeaponSelectorLabel(card);
      }
      if (aimedModeRow.nextElementSibling !== buttonRow) {
        aimedModeRow.after(buttonRow);
      }
    }

    setWeaponButtonState(button, getActiveWeapon(actor)?.id === itemId, card);
  }
}

function selectEquippedWeapon(item) {
  const actor = item.parent;
  if (
    item.type !== "weapon" ||
    item.system.equipped !== "equipped" ||
    !actor ||
    !["character", "mook"].includes(actor.type) ||
    !getEligibleWeapon(actor, item.id)
  ) {
    return;
  }

  activeWeaponIds.set(actor.uuid, item.id);
  if (actor.sheet?.rendered) actor.sheet.render(false);
}

async function getDvTables() {
  if (!dvTablesPromise) {
    dvTablesPromise = SystemUtils.GetDvTables().catch((error) => {
      dvTablesPromise = null;
      throw error;
    });
  }
  return dvTablesPromise;
}

function tableName(table) {
  return table.flags?.babele?.originalName ?? table.name;
}

function findTable(tables, name) {
  return tables.find((table) => table.name === name || tableName(table) === name);
}

function tableRows(table) {
  return table.results
    .filter((result) => result.type === "text" && result.range?.length === 2)
    .map((result) => {
      const value = (result.description ?? "").replace(/<[^>]*>/g, "").trim();
      const parsed = Number.parseInt(value, 10);
      return {
        from: Number(result.range[0]),
        to: Number(result.range[1]),
        dv: Number.isFinite(parsed) ? parsed : null,
      };
    })
    .filter((row) => Number.isFinite(row.from) && Number.isFinite(row.to));
}

async function resolveWeaponDv(actor, weapon, distance) {
  const tables = await getDvTables();
  const base = findTable(tables, weapon.system.dvTable);
  if (!base) return null;

  const autofire =
    actor.getFlag(SYSTEM_ID, `firetype-${weapon.id}`) === "autofire";
  const activeTable =
    autofire
      ? findTable(tables, `${tableName(base)} (Autofire)`) ??
        findTable(tables, `${weapon.system.dvTable} (Autofire)`) ??
        base
      : base;
  const row = tableRows(activeTable).find(
    (entry) => distance >= entry.from && distance <= entry.to
  );

  return {
    table: activeTable,
    dv: row?.dv ?? null,
    outOfRange: !row || row.dv === null,
  };
}

function getCurrentSituation() {
  if (
    !altHeld ||
    !canvas.ready ||
    !canvas.tokens.active ||
    game.activeTool !== "select" ||
    !canvas.app.view.matches(":hover")
  ) {
    return null;
  }

  const controlled = canvas.tokens.controlled;
  if (controlled.length !== 1) return null;
  const shooter = controlled[0];
  if (!shooter.actor || !["character", "mook"].includes(shooter.actor.type)) {
    return null;
  }

  const targets = [...game.user.targets].filter(
    (token) =>
      token !== shooter &&
      token.document.parent?.id === canvas.scene.id
  );
  if (targets.length !== 1) return null;

  const weapon = getActiveWeapon(shooter.actor);
  if (!weapon) return null;

  return { shooter, target: targets[0], weapon };
}

function getDisplayedCenter(token) {
  const draggedToken = canvas.tokens._draggedToken;
  const context =
    draggedToken?.mouseInteractionManager?.interactionData?.contexts?.[
      token.id
    ];
  return context?.clonedToken?.center ?? token.center;
}

function measureDistance(shooter, target) {
  const start = getDisplayedCenter(shooter);
  const end = getDisplayedCenter(target);
  return {
    start,
    end,
    distance: canvas.grid.measurePath([start, end]).distance,
  };
}

function createOverlay() {
  if (overlay || !canvas.interface) return;
  overlay = new PIXI.Container();
  overlay.eventMode = "none";
  overlay.zIndex = Number.MAX_SAFE_INTEGER;
  line = overlay.addChild(new PIXI.Graphics());
  labelBackground = overlay.addChild(new PIXI.Graphics());
  label = overlay.addChild(
    new PIXI.Text("", new PIXI.TextStyle({
      align: "center",
      fill: "#29e0ff",
      fontFamily: "Signika",
      fontSize: 15,
      fontWeight: "bold",
    }))
  );
  label.resolution = Math.max(2, canvas.app.renderer.resolution * 2);
  canvas.interface.addChild(overlay);
  canvas.interface.sortChildren();
  overlay.visible = false;
}

function hideOverlay() {
  if (overlay) overlay.visible = false;
}

function renderOverlay(shooter, target, distance, dvResult) {
  createOverlay();
  if (!overlay) return;

  const { start, end } = measureDistance(shooter, target);
  const zoom = Math.max(Math.hypot(canvas.stage.worldTransform.a, canvas.stage.worldTransform.b), 0.1);
  const scale = (canvas.dimensions.uiScale || 1) / zoom;
  const color = 0xff2e3f;
  const distanceText = localize("CPR.distanceDV.line.distance", {
    distance: distance.toLocaleString(game.i18n.lang, {
      maximumFractionDigits: 1,
    }),
    unit: canvas.scene.grid.units || "m",
  });
  const dvText = dvResult.outOfRange
    ? game.i18n.localize("CPR.distanceDV.line.outOfRange")
    : localize("CPR.distanceDV.line.dv", { dv: dvResult.dv });

  line.clear();
  line.lineStyle({ width: 7 * scale, color: 0x181c25, alpha: 0.95 });
  line.moveTo(start.x, start.y);
  line.lineTo(end.x, end.y);
  line.lineStyle({ width: 4 * scale, color, alpha: 1 });
  line.moveTo(start.x, start.y);
  line.lineTo(end.x, end.y);
  label.text = `${distanceText} · ${dvText}`;
  label.style.fill = "#29e0ff";
  label.style.fontSize = 15 * scale;
  label.anchor.set(0.5);
  const midpointX = (start.x + end.x) / 2;
  const midpointY = (start.y + end.y) / 2;
  label.position.set(midpointX, midpointY);
  label.rotation = 0;

  const paddingX = 8 * scale;
  const paddingY = 4 * scale;
  const width = label.width + paddingX * 2;
  const height = label.height + paddingY * 2;
  labelBackground.clear();
  labelBackground.position.set(midpointX, midpointY);
  labelBackground.rotation = 0;
  labelBackground.beginFill(0x181c25, 0.96);
  labelBackground.lineStyle({ width: 2 * scale, color, alpha: 1 });
  labelBackground.drawRoundedRect(
    -width / 2,
    -height / 2,
    width,
    height,
    4 * scale
  );
  labelBackground.endFill();
  overlay.visible = true;
}

async function refreshOverlay() {
  const situation = getCurrentSituation();
  if (!situation) {
    hideOverlay();
    return;
  }

  const { shooter, target, weapon } = situation;
  const measurement = measureDistance(shooter, target);
  let result = await resolveWeaponDv(shooter.actor, weapon, measurement.distance);
  const current = getCurrentSituation();
  if (
    !current ||
    current.shooter !== shooter ||
    current.target !== target ||
    current.weapon !== weapon
  ) {
    hideOverlay();
    return;
  }
  if (!result) {
    hideOverlay();
    return;
  }
  const latestMeasurement = measureDistance(shooter, target);
  if (latestMeasurement.distance !== measurement.distance) {
    result = await resolveWeaponDv(
      shooter.actor,
      weapon,
      latestMeasurement.distance
    );
    if (!result) {
      hideOverlay();
      return;
    }
  }
  renderOverlay(shooter, target, latestMeasurement.distance, result);
}

function refreshOnEvent() {
  refreshOpenAttackButtons();
  refreshOverlay().catch(reportRangeDifficultyError);
}

function reportRangeDifficultyError(error) {
  hideOverlay();
  if (!tableErrorReported) {
    tableErrorReported = true;
    console.error("cyberpunk-red-core | Failed to resolve range difficulty", error);
    ui.notifications.error(game.i18n.localize("CPR.distanceDV.error.tables"));
  }
}

function handleAltKeyDown(event) {
  if (event.key !== "Alt" || altHeld) return;
  altHeld = true;
  refreshOnEvent();
}

function handleAltKeyUp(event) {
  if (event.key !== "Alt" || !altHeld) return;
  altHeld = false;
  refreshOnEvent();
}

function releaseAltOnBlur() {
  if (!altHeld) return;
  altHeld = false;
  refreshOnEvent();
}

function destroyOverlay() {
  overlay?.destroy({ children: true });
  overlay = undefined;
  line = undefined;
  labelBackground = undefined;
  label = undefined;
}

function attachCanvasListeners() {
  if (!canvas.ready || !canvas.app?.view || canvasView === canvas.app.view) return;
  canvasView?.removeEventListener("pointerleave", hideOverlay);
  canvasView?.removeEventListener("pointerenter", refreshOnEvent);
  canvasView = canvas.app.view;
  canvasView.addEventListener("pointerleave", hideOverlay);
  canvasView.addEventListener("pointerenter", refreshOnEvent);
}

export default function initializeDistanceDv() {
  window.addEventListener("keydown", handleAltKeyDown);
  window.addEventListener("keyup", handleAltKeyUp);
  window.addEventListener("blur", releaseAltOnBlur);
  Hooks.on("renderApplicationV2", (app, element) => {
    if (app.actor || app.document) addWeaponSelectors(app, element);
  });
  Hooks.on("renderApplicationV2", (app, element) => {
    if (app.actor) addWeaponSelectors(app, element);
  });
  Hooks.on("targetToken", (user) => {
    if (user.id === game.user.id) refreshOnEvent();
  });
  Hooks.on("controlToken", refreshOnEvent);
  Hooks.on("activateSceneControls", refreshOnEvent);
  Hooks.on("renderSceneControls", refreshOnEvent);
  Hooks.on("activateCanvasLayer", refreshOnEvent);
  Hooks.on("deactivateCanvasLayer", refreshOnEvent);
  Hooks.on("canvasReady", () => {
    attachCanvasListeners();
    createOverlay();
    refreshOnEvent();
  });
  Hooks.on("canvasTearDown", () => {
    canvasView?.removeEventListener("pointerleave", hideOverlay);
    canvasView?.removeEventListener("pointerenter", refreshOnEvent);
    canvasView = undefined;
    destroyOverlay();
  });
  Hooks.on("updateItem", (item, changes) => {
    const actor = item.parent;
    if (actor && ["character", "mook"].includes(actor.type)) {
      const equippedState =
        changes.system?.equipped ?? changes["system.equipped"];
      if (equippedState === "equipped") {
        selectEquippedWeapon(item);
      } else if (
        activeWeaponIds.get(actor.uuid) === item.id &&
        !getEligibleWeapon(actor, item.id)
      ) {
        activeWeaponIds.delete(actor.uuid);
        if (actor.sheet?.rendered) actor.sheet.render(false);
      }
    }
    refreshOnEvent();
  });
  Hooks.on("createItem", (item) => {
    selectEquippedWeapon(item);
    refreshOnEvent();
  });
  Hooks.on("updateActor", refreshOnEvent);
  Hooks.on("updateToken", refreshOnEvent);
  Hooks.on("moveToken", refreshOnEvent);
  Hooks.on("refreshToken", refreshOnEvent);
  Hooks.on("deleteItem", (item) => {
    const actor = item.parent;
    if (
      actor &&
      ["character", "mook"].includes(actor.type) &&
      activeWeaponIds.get(actor.uuid) === item.id
    ) {
      activeWeaponIds.delete(actor.uuid);
    }
    refreshOnEvent();
  });
}
