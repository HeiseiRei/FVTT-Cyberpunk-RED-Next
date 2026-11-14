import { CPRCharacterActorSheetV2 } from "./cpr-character-sheet.js";
import CPR from "../../system/config.js";
import Rules from "../../utils/cpr-rules.js";

const STAT_ORDER = ["int", "ref", "dex", "tech", "cool", "will", "move", "body"];
const STAT_LABELS = {
  int: "INT",
  ref: "REF",
  dex: "DEX",
  tech: "TECH",
  cool: "COOL",
  will: "WILL",
  move: "MOVE",
  body: "BODY",
};
const LIFEPATH_FIELDS = [
  { id: "culturalOrigin", label: "CPR.characterSheetND.dossier.field.culturalOrigin", group: "origin" },
  { id: "languages", label: "CPR.characterSheetND.dossier.field.languages", group: "origin" },
  { id: "personality", label: "CPR.characterSheetND.dossier.field.personality", group: "origin" },
  { id: "clothingStyle", label: "CPR.characterSheetND.dossier.field.clothingStyle", group: "origin" },
  { id: "hairStyle", label: "CPR.characterSheetND.dossier.field.hairStyle", group: "origin" },
  { id: "affectations", label: "CPR.characterSheetND.dossier.field.affectations", group: "origin" },
  { id: "valueMost", label: "CPR.characterSheetND.dossier.field.valueMost", group: "motives" },
  { id: "aboutPeople", label: "CPR.characterSheetND.dossier.field.aboutPeople", group: "motives" },
  { id: "valuedPerson", label: "CPR.characterSheetND.dossier.field.valuedPerson", group: "motives" },
  { id: "valuedPossession", label: "CPR.characterSheetND.dossier.field.valuedPossession", group: "motives" },
  { id: "familyBackground", label: "CPR.characterSheetND.dossier.field.familyBackground", group: "family" },
  { id: "childhoodEnvironment", label: "CPR.characterSheetND.dossier.field.childhoodEnvironment", group: "family" },
  { id: "familyCrisis", label: "CPR.characterSheetND.dossier.field.familyCrisis", group: "family" },
  { id: "roleLifepath", label: "CPR.characterSheetND.dossier.roleLifepath", group: "role" },
  { id: "friends", label: "CPR.characterSheetND.dossier.field.friends", group: "role" },
  { id: "enemies", label: "CPR.characterSheetND.dossier.field.enemies", group: "role" },
  { id: "tragicLoveAffairs", label: "CPR.characterSheetND.dossier.field.tragicLoveAffairs", group: "role" },
  { id: "lifeGoals", label: "CPR.characterSheetND.dossier.field.lifeGoals", group: "role" },
];
const SKILL_CATEGORY_LABELS = {
  awarenessSkills: "CPR.characterSheetND.skillCategory.awarenessSkills",
  bodySkills: "CPR.characterSheetND.skillCategory.bodySkills",
  controlSkills: "CPR.characterSheetND.skillCategory.controlSkills",
  educationSkills: "CPR.characterSheetND.skillCategory.educationSkills",
  fightingSkills: "CPR.characterSheetND.skillCategory.fightingSkills",
  performanceSkills: "CPR.characterSheetND.skillCategory.performanceSkills",
  rangedweaponSkills: "CPR.characterSheetND.skillCategory.rangedWeaponSkills",
  socialSkills: "CPR.characterSheetND.skillCategory.socialSkills",
  techniqueSkills: "CPR.characterSheetND.skillCategory.techniqueSkills",
};
const INVENTORY_CATEGORY_LABELS = {
  weapon: "CPR.characterSheetND.inventory.category.weapon",
  ammo: "CPR.characterSheetND.inventory.category.ammo",
  armor: "CPR.characterSheetND.inventory.category.armor",
  cyberware: "CPR.characterSheetND.inventory.category.cyberware",
  drug: "CPR.characterSheetND.inventory.category.drug",
  gear: "CPR.characterSheetND.inventory.category.gear",
  clothing: "CPR.characterSheetND.inventory.category.clothing",
  vehicle: "CPR.characterSheetND.inventory.category.vehicle",
  cyberdeck: "CPR.characterSheetND.inventory.category.cyberdeck",
  program: "CPR.characterSheetND.inventory.category.program",
  itemUpgrade: "CPR.characterSheetND.inventory.category.itemUpgrade",
  netarch: "CPR.characterSheetND.inventory.category.netArchitecture",
};
const EQUIP_STATE_LABELS = {
  carried: "CPR.characterSheetND.inventory.equipState.carried",
  equipped: "CPR.characterSheetND.inventory.equipState.equipped",
  owned: "CPR.characterSheetND.inventory.equipState.owned",
};
const LIFEPATH_GROUPS = [
  { id: "origin", label: "CPR.characterSheetND.dossier.file01" },
  { id: "motives", label: "CPR.characterSheetND.dossier.file02" },
  { id: "family", label: "CPR.characterSheetND.dossier.file03" },
  { id: "role", label: "CPR.characterSheetND.dossier.file04" },
];
const TEMPLATE = "systems/cyberpunk-red-core/templates/actor/cpr-character-sheet-nd.hbs";
const WOUND_TEMPLATE = "systems/cyberpunk-red-core/templates/actor/cpr-character-sheet-nd-critical-wounds.hbs";
const LEGACY_WEAPON_ORDER_SCOPE = "cpr-sheet-themes";
const INVENTORY_TYPES = Object.keys(CPR.inventoryCategories);
const LOADOUT_TYPES = new Set(["weapon", "armor", "drug"]);

function getSkillView(skill, actor) {
  const rank = Number(skill.system.level) || 0;
  const stat = skill.system.stat;
  const statValue = Number(actor.system.stats[stat]?.value) || 0;
  const total = statValue + rank;

  return {
    id: skill.id,
    document: skill,
    rank,
    statAbbr: STAT_LABELS[stat] ?? stat.toUpperCase(),
    statValue,
    total,
    isPinned: Boolean(skill.system.favorite),
    isMaster: rank >= 6,
    isHigh: total >= 14 || rank >= 6,
  };
}

function plainText(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function getWeaponOrder(actor) {
  const coreOrder = actor.getFlag(game.system.id, "weaponOrder")?.ids;
  if (Array.isArray(coreOrder)) return coreOrder;
  return actor.flags[LEGACY_WEAPON_ORDER_SCOPE]?.weaponOrder?.ids;
}

export default class CPRCharacterActorSheetND extends CPRCharacterActorSheetV2 {
  static DEFAULT_OPTIONS = {
    ...CPRCharacterActorSheetV2.DEFAULT_OPTIONS,
    classes: [...CPRCharacterActorSheetV2.DEFAULT_OPTIONS.classes, "cpr-sheet-nd"],
    position: { ...CPRCharacterActorSheetV2.DEFAULT_OPTIONS.position, width: 1200, height: 900 },
    window: { ...CPRCharacterActorSheetV2.DEFAULT_OPTIONS.window, icon: "fa-solid fa-skull" },
  };

  get title() {
    return `CHARACTER // ${this.document.name}`;
  }

  static PARTS = {
    sheet: { template: TEMPLATE },
  };

  static TABS = {
    primary: {
      tabs: [{ id: "dashboard" }, { id: "dossier" }, { id: "inventory" }],
      initial: "dashboard",
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    const handCount = actor.getHands();
    const usedHands = Math.max(0, handCount - actor.getFreeHands());
    const stats = STAT_ORDER
      .filter((key) => actor.system.stats[key])
      .map((key) => ({
        key,
        label: STAT_LABELS[key],
        value: actor.system.stats[key].value,
        max: actor.system.stats[key].max ?? actor.system.stats[key].value,
      }));
    const skills = Array.from(actor.itemTypes.skill ?? []);
    const skillGroups = Object.entries(CPR.skillCategories).map(([category]) => ({
      category,
      label: game.i18n.localize(SKILL_CATEGORY_LABELS[category] ?? category),
      skills: skills.filter((skill) => skill.system.category === category),
    })).filter((group) => group.skills.length);
    const skillColumnOrder = [
      ["awarenessSkills", "rangedweaponSkills"],
      ["controlSkills", "socialSkills"],
      ["bodySkills", "fightingSkills", "performanceSkills"],
      ["educationSkills"],
      ["techniqueSkills"],
    ];
    const skillColumns = skillColumnOrder.map((categories) =>
      categories.map((category) => skillGroups.find((group) => group.category === category)).filter(Boolean)
    );
    const savedWeaponOrder = getWeaponOrder(actor);
    const weaponOrder = Array.isArray(savedWeaponOrder) ? savedWeaponOrder : [];
    const weaponOrderIndex = new Map(weaponOrder.map((id, index) => [id, index]));
    const weapons = Array.from(actor.itemTypes.weapon ?? [])
      .filter((weapon) => weapon.system.equipped === "equipped")
      .sort((a, b) => {
        const indexA = weaponOrderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const indexB = weaponOrderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return indexA - indexB;
      });
    const weaponCards = weapons.slice(0, 3).map((weapon) => ({
      id: weapon.id,
      name: weapon.name,
      system: weapon.system,
      isAimed: actor.getFlag(game.system.id, `firetype-${weapon.id}`) === "aimed",
    }));
    const armorItems = Array.from(actor.itemTypes.armor ?? []);
    const armorStats = new Map(await Promise.all(armorItems.map(async (item) => {
      const [headMax, headCurrent, bodyMax, bodyCurrent] = await Promise.all([
        item.system.isHeadLocation ? item.getArmorSP("head") : 0,
        item.system.isHeadLocation ? item.getArmorSP("head", true) : 0,
        item.system.isBodyLocation ? item.getArmorSP("body") : 0,
        item.system.isBodyLocation ? item.getArmorSP("body", true) : 0,
      ]);
      return [item.id, { headMax, headCurrent, bodyMax, bodyCurrent }];
    })));
    const armor = armorItems
      .filter((item) => item.system.equipped === "equipped")
      .map((item) => ({
        id: item.id,
        name: item.name,
        system: item.system,
        ...armorStats.get(item.id),
      }));
    const roles = Array.from(actor.itemTypes.role ?? []);
    const role = roles
      .find((item) => item.system.mainRoleAbility === actor.system.roleInfo.activeRole)
      ?? roles[0]
      ?? null;
    const luck = actor.system.stats.luck;
    const luckMax = Math.max(0, Math.floor(Number(luck.max ?? luck.value) || 0));
    const luckValue = Number(luck.value) || 0;
    const luckSegments = Array.from({ length: luckMax }, (_, index) => ({
      value: index + 1,
      filled: index + 1 <= luckValue,
    }));
    const empathy = actor.system.stats.emp;
    const empathyMax = Math.min(99, Math.max(0, Math.floor(Number(empathy.max) || 0)));
    const empathyValue = Number(empathy.value) || 0;
    const empathySegments = Array.from({ length: empathyMax }, (_, index) => ({
      value: index + 1,
      filled: index + 1 <= empathyValue,
    }));
    const lifePathFields = LIFEPATH_FIELDS.map(({ id, label, group }) => ({
      id,
      group,
      label: game.i18n.localize(label),
      value: plainText(actor.system.lifepath?.[id]),
    }));
    const availableLifePathIds = new Set(lifePathFields.map(({ id }) => id));
    const lifePathLabels = new Map(lifePathFields.map(({ id, label }) => [id, label]));
    const pinnedLifepath = Array.isArray(actor.getFlag(game.system.id, "pinnedLifepath"))
      ? actor.getFlag(game.system.id, "pinnedLifepath")
        .filter((pin) => (
          pin
          && availableLifePathIds.has(pin.id)
          && typeof pin.label === "string"
          && typeof pin.value === "string"
        ))
        .filter((pin, index, pins) => pins.findIndex((other) => other.id === pin.id) === index)
        .map((pin) => ({ ...pin, label: lifePathLabels.get(pin.id) }))
        .slice(0, 3)
      : [];
    const pinnedLifePathIds = new Set(pinnedLifepath.map(({ id }) => id));
    const lifePathModules = LIFEPATH_GROUPS.map(({ id, label }) => ({
      id,
      label: game.i18n.localize(label),
      fields: lifePathFields
        .filter((field) => field.group === id)
        .map((field) => ({ ...field, isPinned: pinnedLifePathIds.has(field.id) })),
    }));
    const pinnedLifepathSlots = [
      ...pinnedLifepath.map((pin) => ({ ...pin, isEmpty: false })),
      ...Array.from({ length: 3 - pinnedLifepath.length }, () => ({ isEmpty: true })),
    ];
    const inventoryDocuments = INVENTORY_TYPES
      .flatMap((type) => Array.from(actor.itemTypes[type] ?? []))
      .filter((item) => item.type !== "cyberware" || !item.system.isInstalled)
      .sort((a, b) => a.name.localeCompare(b.name));
    const inventoryRows = inventoryDocuments.map((item) => {
      const typeLabel = game.i18n.localize(INVENTORY_CATEGORY_LABELS[item.type] ?? item.type);
      const amount = item.system.amount;
      const equipLabel = EQUIP_STATE_LABELS[item.system.equipped];
      const armorValues = armorStats.get(item.id) ?? {
        headCurrent: 0,
        headMax: 0,
        bodyCurrent: 0,
        bodyMax: 0,
      };
      return {
        item,
        category: item.type,
        draggable: ["weapon", "armor"].includes(item.type),
        searchableText: `${item.name} ${typeLabel}`.toLocaleLowerCase(game.i18n.lang),
        hasAmount: typeof amount === "number",
        typeLabel,
        equipLabel: equipLabel ? game.i18n.localize(equipLabel) : "",
        ammoPercent: item.system.magazine?.max > 0
          ? Math.round((item.system.magazine.value / item.system.magazine.max) * 100)
          : 0,
        ...armorValues,
      };
    });
    const loadoutGroups = ["weapon", "armor", "drug"].map((category) => ({
      category,
      label: game.i18n.localize(INVENTORY_CATEGORY_LABELS[category]),
      rows: inventoryRows.filter((row) => row.category === category),
    }));
    const backpackGroups = INVENTORY_TYPES
      .filter((category) => !LOADOUT_TYPES.has(category))
      .map((category) => ({
        category,
        label: game.i18n.localize(INVENTORY_CATEGORY_LABELS[category] ?? category),
        rows: inventoryRows.filter((row) => row.category === category),
      }))
      .filter((group) => group.rows.length > 0);
    const backpackItemCount = backpackGroups.reduce((count, group) => count + group.rows.length, 0);
    const loadoutItemCount = loadoutGroups.reduce((count, group) => count + group.rows.length, 0);
    const pinnedItems = inventoryDocuments.filter((item) => item.system.favorite);
    const criticalInjuries = Array.from(actor.itemTypes.criticalInjury ?? []);

    return {
      ...context,
      isNDSheet: true,
      actor,
      isEditable: this.isEditable,
      handCount,
      usedHands,
      handSlots: Array.from({ length: handCount }, (_, index) => index < usedHands),
      handsOverLimit: usedHands > handCount,
      stats,
      skillColumns: skillColumns.map((column) => column.map((group) => ({
        ...group,
        skills: group.skills.map((skill) => getSkillView(skill, actor)),
      }))),
      pinnedSkills: skills
        .filter((skill) => skill.system.favorite)
        .map((skill) => getSkillView(skill, actor)),
      activeSkillsFilter: this._skillsFilter === "trained" ? "trained" : "all",
      allSkillsFilterActive: this._skillsFilter !== "trained",
      trainedSkillsFilterActive: this._skillsFilter === "trained",
      weapons: weaponCards,
      armor,
      loadoutGroups,
      backpackGroups,
      backpackItemCount,
      loadoutItemCount,
      cyberware: Array.from(actor.itemTypes.cyberware ?? []).filter((item) => item.system.isInstalled),
      criticalInjuries,
      hasOpenCriticalInjuries: criticalInjuries.length > 0,
      pinnedItems,
      inventoryRows,
      inventorySearch: this._inventorySearch ?? "",
      role,
      lifePathModules,
      pinnedLifepath,
      pinnedLifepathSlots,
      luckValue,
      luckMax,
      luckSegments,
      empathySegments,
      lowEmpathy: empathyMax > 0 && empathyValue / empathyMax < 0.5,
      seriouslyWounded: actor.system.derivedStats.hp.value <= Math.ceil(actor.system.derivedStats.hp.max / 2),
      cyberpsychosisWarning: actor.system.derivedStats.humanity.value <= 0,
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.classList.toggle("cpr-nd-dossier-active", this.tabGroups.primary === "dossier");
    const surface = this.element.querySelector(".cpr-nd-surface");
    if (!surface) throw new Error("Unable to initialize the CPR ND controls.");
    if (this.element.classList.contains("cpr-nd-wounds-open")) this.#positionCriticalWoundsDrawer();

    surface.addEventListener("click", (event) => {
      const clickTarget = event.target instanceof Element ? event.target : null;
      const primaryTab = clickTarget?.closest("[data-action='tab'][data-group='primary']");
      if (primaryTab) {
        this.element.classList.toggle("cpr-nd-dossier-active", primaryTab.dataset.tab === "dossier");
      }
      clickTarget
        ?.closest(".cpr-nd-inventory-item-name .gear-name-toggle")
        ?.blur();
      if (
        this.element.classList.contains("cpr-nd-skills-open")
        && clickTarget
        && !clickTarget.closest(".cpr-nd-skills-drawer, [data-cpr-nd-action='toggle-skills']")
      ) {
        this.element.classList.remove("cpr-nd-skills-open");
      }
      if (
        this.element.classList.contains("cpr-nd-wounds-open")
        && clickTarget
        && !clickTarget.closest(".cpr-nd-wounds-drawer, [data-cpr-nd-action='open-critical-wounds']")
      ) {
        this.element.classList.remove("cpr-nd-wounds-open");
      }

      const empathyBattery = event.target instanceof Element
        ? event.target.closest(".cpr-nd-empathy-content")
        : null;
      const luckScale = event.target instanceof Element
        ? event.target.closest(".cpr-nd-luck-track")
        : null;
      if (empathyBattery || luckScale) {
        event.preventDefault();
        const adjust = empathyBattery
          ? this.#adjustEmpathy(1)
          : this.#adjustLuck(1);
        void adjust.catch((error) => this.#reportError("Could not increase the stat value.", error));
        return;
      }

      const target = event.target instanceof Element ? event.target.closest("[data-cpr-nd-action]") : null;
      if (!target) return;
      event.preventDefault();
      if (["open-ledger", "open-critical-wounds"].includes(target.dataset.cprNdAction) && event.detail > 0) {
        target.blur();
      }
      void this.#handleAction(target, event).catch((error) => this.#reportError("Could not complete the CPR sheet action.", error));
    });

    surface.addEventListener("contextmenu", (event) => {
      const skillTarget = event.target instanceof Element
        ? event.target.closest(".cpr-nd-skill-row[data-item-id], [data-cpr-nd-quick-skill][data-item-id]")
        : null;
      if (skillTarget) {
        event.preventDefault();
        event.stopPropagation();
        if (!this.isEditable) return;

        const skill = this.document.items.get(skillTarget.dataset.itemId);
        if (!skill || skill.type !== "skill") {
          this.#reportError("Skill is no longer on this character.", new Error(skillTarget.dataset.itemId));
          return;
        }

        const isQuickCheck = skillTarget.hasAttribute("data-cpr-nd-quick-skill");
        const pinned = isQuickCheck ? false : !skill.system.favorite;
        if (pinned === skill.system.favorite) return;

        void skill.update({ "system.favorite": pinned })
          .catch((error) => this.#reportError("Could not toggle the skill pin.", error));
        return;
      }

      const woundRow = event.target instanceof Element
        ? event.target.closest(".cpr-nd-wound-item[data-item-id]")
        : null;
      if (woundRow) {
        event.preventDefault();
        if (!this.isEditable) return;

        const injury = this.document.items.get(woundRow.dataset.itemId);
        if (!injury || injury.type !== "criticalInjury") {
          this.#reportError("Critical injury is no longer on this character.", new Error(woundRow.dataset.itemId));
          return;
        }

        void this.document.deleteEmbeddedDocuments("Item", [injury.id])
          .then(() => this.#refreshCriticalWoundsDrawer())
          .catch((error) => this.#reportError("Could not remove the critical injury.", error));
        return;
      }

      const empathyBattery = event.target instanceof Element
        ? event.target.closest(".cpr-nd-empathy-content")
        : null;
      const luckScale = event.target instanceof Element
        ? event.target.closest(".cpr-nd-luck-track")
        : null;
      if (!empathyBattery && !luckScale) return;
      event.preventDefault();
      const adjust = empathyBattery
        ? this.#adjustEmpathy(-1)
        : this.#adjustLuck(-1);
      void adjust.catch((error) => this.#reportError("Could not decrease the stat value.", error));
    });

    surface.addEventListener("dragstart", (event) => {
      const inventoryRow = event.target instanceof Element
        ? event.target.closest(".cpr-nd-inventory-row.item[data-item-id]")
        : null;
      if (inventoryRow) {
        this.#startInventoryDrag(event, inventoryRow);
        return;
      }

      const title = event.target instanceof Element
        ? event.target.closest("[data-cpr-nd-weapon-drag]")
        : null;
      if (!title) return;
      if (!this.isEditable) {
        event.preventDefault();
        return;
      }
      this._draggedWeaponId = title.dataset.itemId;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", title.dataset.itemId);
      title.closest(".cpr-nd-weapon")?.classList.add("is-dragging");
    });

    surface.addEventListener("dragend", (event) => {
      if (!(event.target instanceof Element)) return;
      this._draggedInventoryItemId = null;
      event.target.closest(".cpr-nd-weapon")?.classList.remove("is-dragging");
      surface.querySelectorAll(".cpr-nd-weapon.is-drop-target")
        .forEach((card) => card.classList.remove("is-drop-target"));
      surface.querySelectorAll("[data-equip-drop].cpr-drop-target-active")
        .forEach((target) => target.classList.remove("cpr-drop-target-active"));
      this._draggedWeaponId = null;
    });

    surface.addEventListener("dragover", (event) => {
      const equipTarget = event.target instanceof Element
        ? event.target.closest("[data-equip-drop]")
        : null;
      const draggedItem = this.document.items.get(this._draggedInventoryItemId);
      if (
        draggedItem
        && equipTarget?.dataset.equipDrop === draggedItem.type
        && this.isEditable
      ) {
        surface.querySelectorAll("[data-equip-drop]")
          .forEach((target) => target.classList.toggle("cpr-drop-target-active", target === equipTarget));
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        return;
      }

      surface.querySelectorAll("[data-equip-drop].cpr-drop-target-active")
        .forEach((target) => target.classList.remove("cpr-drop-target-active"));
      if (!this._draggedWeaponId) return;
      const card = event.target instanceof Element
        ? event.target.closest(".cpr-nd-weapon[data-item-id]")
        : null;
      if (!card || !this.isEditable) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      surface.querySelectorAll(".cpr-nd-weapon.is-drop-target")
        .forEach((item) => item.classList.remove("is-drop-target"));
      card.classList.add("is-drop-target");
    });

    surface.addEventListener("drop", (event) => {
      if (this._draggedInventoryItemId) {
        const equipTarget = event.target instanceof Element
          ? event.target.closest("[data-equip-drop]")
          : null;
        if (!equipTarget) return;

        event.preventDefault();
        event.stopPropagation();
        const item = this.document.items.get(this._draggedInventoryItemId);
        this._draggedInventoryItemId = null;
        equipTarget.classList.remove("cpr-drop-target-active");
        if (!item || !this.isEditable || item.type !== equipTarget.dataset.equipDrop) return;
        void this.#equipInventoryItem(item)
          .catch((error) => this.#reportError("Could not equip dragged inventory item.", error));
        return;
      }

      if (!this._draggedWeaponId) return;
      const card = event.target instanceof Element
        ? event.target.closest(".cpr-nd-weapon[data-item-id]")
        : null;
      if (!card || !this.isEditable) return;
      event.preventDefault();
      const draggedId = this._draggedWeaponId;
      const targetId = card.dataset.itemId;
      if (!draggedId || draggedId === targetId) return;
      void this.#reorderWeapons(draggedId, targetId, event.clientY, card)
        .catch((error) => this.#reportError("Could not reorder weapons.", error));
    });

    const inventorySearch = surface.querySelector("[data-cpr-nd-inventory-search]");
    inventorySearch?.addEventListener("input", () => {
      this._inventorySearch = inventorySearch.value;
      this.#filterInventory(surface);
    });
    this.#filterInventory(surface);
    this.#filterSkillsByRank(surface, this._skillsFilter ?? "all");
  }

  #startInventoryDrag(event, inventoryRow) {
    if (!this.isEditable) {
      event.preventDefault();
      return;
    }
    if (this._draggedInventoryItemId === inventoryRow.dataset.itemId) return;

    const item = this.document.items.get(inventoryRow.dataset.itemId);
    if (!item) throw new Error(`Inventory item ${inventoryRow.dataset.itemId} is no longer on this character.`);
    const tokenId = this.token === null ? null : this.token.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "Item",
        uuid: item.uuid,
        system: {
          actorId: this.document.id,
          tokenId,
          data: item,
        },
      })
    );
    this._draggedInventoryItemId = inventoryRow.dataset.itemId;
  }

  _onDragStart(event) {
    const inventoryRow = event.target instanceof Element
      ? event.target.closest(".cpr-nd-inventory-row.item[data-item-id]")
      : null;
    if (inventoryRow) return this.#startInventoryDrag(event, inventoryRow);
    return super._onDragStart(event);
  }

  async _setEquipState(event) {
    const item = this.actor.getOwnedItem(this.constructor._getItemId(event));
    if (
      item?.type !== "weapon"
      || event.currentTarget.dataset.equipState !== "equipped"
      || item.system.equipped === "equipped"
      || this.document.canHoldWeapon(item)
    ) {
      return super._setEquipState(event);
    }

    event.preventDefault();
    event.currentTarget.closest(".gear-equip-menu")?.hidePopover();
    await this.#equipWeapon(item);
  }

  async #equipInventoryItem(item) {
    if (item.system.equipped === "equipped") return;

    if (item.type === "weapon") return this.#equipWeapon(item);

    if (item.type === "armor") {
      if (item.system.isHeadLocation) {
        this.document.updateTrackedArmor("head", item.id);
      } else if (item.system.isBodyLocation) {
        this.document.updateTrackedArmor("body", item.id);
      } else if (item.system.isShield) {
        this.document.updateTrackedArmor("shield", item.id);
      }
    }

    await this.document.updateEmbeddedDocuments("Item", [
      { _id: item.id, "system.equipped": "equipped" },
    ]);
    await this.render({ force: true });
  }

  async #equipWeapon(item) {
    if (!this.isEditable || item.system.equipped === "equipped") return false;

    let replacementIds = [];
    if (!this.document.canHoldWeapon(item)) {
      const replacementOptions = this.document.getWeaponReplacementOptions(item);
      if (replacementOptions.length === 0) {
        Rules.lawyer(false, "CPR.messages.warningTooManyHands");
        return false;
      }

      replacementIds = await this.#promptWeaponReplacement(item, replacementOptions);
      if (!replacementIds) return false;

      const activeWeapons = new Map(
        this.document.system.weapons.equipped.map((weapon) => [weapon.id, weapon])
      );
      if (replacementIds.some((id) => !activeWeapons.has(id))) {
        throw new Error("An active weapon changed while the replacement dialog was open.");
      }

      if (!this.document.canHoldWeapon(item, replacementIds)) {
        throw new Error("The selected weapons do not free enough hands for this weapon.");
      }
    }

    const updates = replacementIds.map((id) => ({
      _id: id,
      "system.equipped": "carried",
    }));
    updates.push({ _id: item.id, "system.equipped": "equipped" });
    await this.document.updateEmbeddedDocuments("Item", updates);
    await this.render({ force: true });
    return true;
  }

  #promptWeaponReplacement(weapon, replacementOptions) {
    const options = replacementOptions.map(({ weapons }) => weapons.map((item) => item.id));
    const choices = replacementOptions.map(({ weapons, handsFreed }, index) => {
      const names = weapons.map((item) => item.name).join(", ");
      const handsLabel = game.i18n.format("CPR.characterSheetND.weaponReplaceHands", {
        hands: handsFreed,
      });
      return `<button type="button" class="cpr-nd-weapon-replacement-option${index === 0 ? " is-selected" : ""}" role="radio" aria-checked="${index === 0}" data-weapon-replacement="${index}"><span class="cpr-nd-weapon-replacement-name">${escapeHtml(names)}</span><span class="cpr-nd-weapon-replacement-hands">${escapeHtml(handsLabel)}</span></button>`;
    }).join("");
    const instructions = game.i18n.localize("CPR.characterSheetND.weaponReplaceInstructions");
    const prompt = game.i18n.localize("CPR.characterSheetND.weaponReplacePrompt");
    let settled = false;
    return new Promise((resolve) => {
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      new Dialog({
        title: game.i18n.localize("CPR.characterSheetND.weaponReplaceTitle"),
        content: `<section class="cpr-nd-weapon-replacement-content"><div class="cpr-nd-weapon-replacement-alert"><span class="cpr-nd-weapon-replacement-kicker">${escapeHtml(prompt)}</span><strong>${escapeHtml(weapon.name)}</strong></div><p class="cpr-nd-weapon-replacement-instructions">${escapeHtml(instructions)}</p><fieldset class="cpr-nd-weapon-replacement-options" role="radiogroup" aria-label="${escapeHtml(instructions)}">${choices}</fieldset></section>`,
        render: (html) => {
          html.closest(".window-app")
            .addClass("cpr-nd-weapon-replacement-dialog cpr-nd-dialog");
          html.find("[data-weapon-replacement]").on("click", (event) => {
            const selected = event.currentTarget;
            html.find("[data-weapon-replacement]")
              .attr("aria-checked", "false")
              .removeClass("is-selected");
            selected.setAttribute("aria-checked", "true");
            selected.classList.add("is-selected");
          });
        },
        buttons: {
          replace: {
            label: game.i18n.localize("CPR.characterSheetND.weaponReplaceConfirm"),
            callback: (html) => {
              const selected = Number(html.find('[data-weapon-replacement][aria-checked="true"]').attr("data-weapon-replacement"));
              finish(Number.isInteger(selected) ? options[selected] ?? null : null);
            },
          },
          cancel: {
            label: game.i18n.localize("CPR.characterSheetND.weaponReplaceCancel"),
            callback: () => finish(null),
          },
        },
        default: "replace",
        close: () => finish(null),
      }).render(true);
    });
  }

  #filterInventory(surface = this.element) {
    const search = surface.querySelector("[data-cpr-nd-inventory-search]");
    const query = (search?.value ?? this._inventorySearch ?? "").trim().toLocaleLowerCase(game.i18n.lang);
    const filter = this._inventoryFilter ?? "all";
    const rows = surface.querySelectorAll(".cpr-nd-backpack .cpr-nd-inventory-row");
    for (const row of rows) {
      row.hidden = (filter !== "all" && row.dataset.filterCategory !== filter)
        || (query !== "" && !(row.dataset.searchableText ?? "").includes(query));
    }
    for (const button of surface.querySelectorAll("[data-inventory-filter]")) {
      const selected = button.dataset.inventoryFilter === filter;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    for (const group of surface.querySelectorAll("[data-inventory-group]")) {
      group.hidden = !group.querySelector(".cpr-nd-inventory-row:not([hidden])");
    }
    const count = surface.querySelector("[data-cpr-nd-inventory-count]");
    if (count) count.textContent = `${Array.from(rows).filter((row) => !row.hidden).length} ITEMS`;
  }

  async #reorderWeapons(draggedId, targetId, clientY, targetCard) {
    const weaponIds = Array.from(this.document.itemTypes.weapon ?? [])
      .sort((a, b) => Number(b.system.equipped === "equipped") - Number(a.system.equipped === "equipped"))
      .map((weapon) => weapon.id);
    const storedOrder = getWeaponOrder(this.document);
    const savedOrder = Array.isArray(storedOrder) ? storedOrder : [];
    const orderIndex = new Map(savedOrder.map((id, index) => [id, index]));
    weaponIds.sort((a, b) => {
      const indexA = orderIndex.get(a) ?? Number.MAX_SAFE_INTEGER;
      const indexB = orderIndex.get(b) ?? Number.MAX_SAFE_INTEGER;
      return indexA - indexB;
    });

    const fromIndex = weaponIds.indexOf(draggedId);
    const targetIndex = weaponIds.indexOf(targetId);
    if (fromIndex < 0 || targetIndex < 0) return;

    const [dragged] = weaponIds.splice(fromIndex, 1);
    const insertIndex = weaponIds.indexOf(targetId)
      + (clientY > targetCard.getBoundingClientRect().top + targetCard.offsetHeight / 2 ? 1 : 0);
    weaponIds.splice(insertIndex, 0, dragged);
    await this.document.setFlag(game.system.id, "weaponOrder", { ids: weaponIds });
    await this.render(false);
  }

  async #handleAction(target, event) {
    const action = target.dataset.cprNdAction;
    const id = target.dataset.itemId;

    if (action === "inventory-filter") {
      this._inventoryFilter = target.dataset.filter ?? "all";
      this.#filterInventory();
      return;
    }
    if (action === "open-item") {
      const item = this.document.items.get(id);
      if (!item) throw new Error(`Inventory item ${id} is no longer on this character.`);
      await item.sheet.render(true, { editable: this.isEditable });
      return;
    }
    if (action === "adjust-armor") {
      if (!this.isEditable) return;
      const location = target.dataset.location;
      const delta = Number(target.dataset.delta);
      if (!["head", "body"].includes(location) || !Number.isInteger(delta) || delta === 0) {
        throw new Error("Invalid armor adjustment.");
      }
      await this.document.ablateArmor(location, delta);
      return;
    }
    if (action === "inventory-use-drug") {
      if (!this.isEditable) return;
      const drug = this.document.items.get(id);
      if (!drug || drug.type !== "drug") throw new Error(`Consumable ${id} is no longer on this character.`);
      await drug.snort();
      await this.document.updateEmbeddedDocuments("Item", [
        { _id: drug.id, system: drug.system.toObject(false) },
      ]);
      return;
    }

    if (action === "portrait") {
      const tokenizer = game.modules.get("tokenizer-2");
      if (tokenizer?.active) {
        if (typeof tokenizer.api?.openEditor !== "function") {
          throw new Error("Tokenizer 2 is active but its editor API is unavailable.");
        }
        await tokenizer.api.openEditor(this.document, this.token);
        return;
      }
      new foundry.applications.apps.FilePicker.implementation({
        type: "image",
        current: this.document.img,
        callback: async (path) => {
          try {
            await this.document.update({ img: path });
          } catch (error) {
            this.#reportError("Could not update the character portrait.", error);
          }
        },
      }).render(true);
      return;
    }
    if (action === "roll-stat") {
      await this.#roll(target, event, "stat", target.dataset.stat);
      return;
    }
    if (action === "roll-death-save") {
      await this.#roll(target, event, "deathsave", target.dataset.rollTitle);
      return;
    }
    if (action === "roll-skill") {
      await this.#roll(target, event, "skill");
      return;
    }
    if (action === "filter-skills") {
      this.#filterSkillsByRank(
        this.element.querySelector(".cpr-nd-surface"),
        target.dataset.filter
      );
      return;
    }
    if (action === "roll-role") {
      await this.#roll(target, event, "roleAbility", target.dataset.rollTitle, "mainRoleAbility");
      return;
    }
    if (action === "roll-weapon") {
      await this.#roll(target, event, "attack");
      return;
    }
    if (action === "roll-damage") {
      await this.#roll(target, event, "damage");
      return;
    }
    if (action === "aim-weapon") {
      if (!this.isEditable) return;
      const flag = `firetype-${id}`;
      if (this.document.getFlag(game.system.id, flag) === "aimed") {
        await this.document.unsetFlag(game.system.id, flag);
      } else {
        await this.document.setFlag(game.system.id, flag, "aimed");
      }
      return;
    }
    if (action === "reload-weapon" || action === "change-ammo") {
      if (!this.isEditable) return;
      const weapon = this.document.items.get(id);
      if (!weapon) throw new Error(`Weapon ${id} is no longer on this character.`);
      await weapon.doAction(this.document, target.attributes);
      await this.document.updateEmbeddedDocuments("Item", [
        { _id: weapon.id, system: weapon.system.toObject(false) },
      ]);
      return;
    }
    if (action === "toggle-skills") {
      this.element.classList.toggle("cpr-nd-skills-open");
      if (this.element.classList.contains("cpr-nd-skills-open")) {
        this.element.classList.remove("cpr-nd-wounds-open");
        this.element.querySelector(".cpr-nd-skills-filter [aria-pressed='true']")
          ?.focus({ preventScroll: true });
      }
      return;
    }
    if (action === "close-skills") {
      this.element.classList.remove("cpr-nd-skills-open");
      return;
    }
    if (action === "open-ledger") {
      await this.showLedger(target.dataset.ledgerProperty);
      return;
    }
    if (action === "roll-critical-injury") {
      await this._rollCriticalInjury();
      return;
    }
    if (action === "open-critical-wounds") {
      const isOpen = this.element.classList.toggle("cpr-nd-wounds-open");
      if (isOpen) {
        this.#positionCriticalWoundsDrawer();
        this.element.classList.remove("cpr-nd-skills-open");
      }
      return;
    }
    if (action === "close-critical-wounds") {
      this.element.classList.remove("cpr-nd-wounds-open");
      return;
    }
    if (action === "open-critical-injury") {
      const injury = this.document.items.get(id);
      if (!injury || injury.type !== "criticalInjury") {
        this.#reportError("Critical injury is no longer on this character.", new Error(id));
        return;
      }
      this.element.classList.remove("cpr-nd-wounds-open");
      await injury.sheet.render(true);
      return;
    }
    if (action === "pin-skill") {
      const skill = this.document.items.get(id);
      if (!skill) throw new Error(`Skill ${id} is no longer on this character.`);
      await skill.update({ "system.favorite": !skill.system.favorite });
      return;
    }
    if (action === "pin-lifepath") {
      if (!this.isEditable) return;
      const field = LIFEPATH_FIELDS.find((entry) => entry.id === target.dataset.lifepathId);
      if (!field) throw new Error(`Unknown lifepath field ${target.dataset.lifepathId}.`);
      const storedPins = this.document.getFlag(game.system.id, "pinnedLifepath");
      const pins = Array.isArray(storedPins)
        ? storedPins.filter((pin) => (
          pin
          && typeof pin.id === "string"
          && LIFEPATH_FIELDS.some(({ id: fieldId }) => fieldId === pin.id)
          && typeof pin.label === "string"
          && typeof pin.value === "string"
        ))
          .filter((pin, index, validPins) => (
            validPins.findIndex((other) => other.id === pin.id) === index
          ))
          .slice(0, 3)
        : [];
      const existingIndex = pins.findIndex((pin) => pin.id === field.id);
      if (existingIndex >= 0) {
        pins.splice(existingIndex, 1);
      } else {
        if (pins.length >= 3) {
          const counter = this.element.querySelector("[data-cpr-nd-pin-counter]");
          if (counter) {
            counter.classList.remove("is-shaking");
            void counter.offsetWidth;
            counter.classList.add("is-shaking");
            counter.addEventListener(
              "animationend",
              () => counter.classList.remove("is-shaking"),
              { once: true }
            );
          }
          return;
        }
        pins.push({
          id: field.id,
          label: game.i18n.localize(field.label),
          value: plainText(this.document.system.lifepath?.[field.id]),
        });
      }
      await this.document.setFlag(game.system.id, "pinnedLifepath", pins);
      return;
    }
    if (action === "ammo-down") {
      if (!this.isEditable) return;
      const weapon = this.document.items.get(id);
      if (!weapon) throw new Error(`Weapon ${id} is no longer on this character.`);
      const current = Number(weapon.system.magazine?.value ?? 0);
      await weapon.update({ "system.magazine.value": Math.max(0, current - 1) });
      return;
    }
    if (action === "ablate-armor") {
      if (!this.isEditable) return;
      await this.document.ablateArmor(target.dataset.location, 1);
    }
  }

  #positionCriticalWoundsDrawer() {
    const surface = this.element.querySelector(".cpr-nd-surface");
    const drawer = surface?.querySelector(".cpr-nd-wounds-drawer");
    const trigger = surface?.querySelector("[data-cpr-nd-action='open-critical-wounds']");
    if (!surface || !drawer || !trigger) {
      throw new Error("Unable to position the critical wounds drawer.");
    }

    const surfaceRect = surface.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const width = Math.max(0, Math.min(280, surfaceRect.width - 24));
    const left = Math.max(12, Math.min(triggerRect.left - surfaceRect.left, surfaceRect.width - width - 12));
    const top = triggerRect.bottom - surfaceRect.top + 6;
    const maxHeight = Math.max(0, Math.min(300, surfaceRect.bottom - triggerRect.bottom - 18));
    drawer.style.left = `${left}px`;
    drawer.style.top = `${top}px`;
    drawer.style.width = `${width}px`;
    drawer.style.maxHeight = `${maxHeight}px`;
  }

  async #refreshCriticalWoundsDrawer() {
    const injuries = Array.from(this.document.itemTypes.criticalInjury ?? [])
      .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang))
      .map((injury) => ({
        id: injury.id,
        name: injury.name,
        deathSaveIncrease: injury.system.deathSaveIncrease,
      }));
    const content = await foundry.applications.handlebars.renderTemplate(
      WOUND_TEMPLATE,
      { injuries },
    );
    const drawer = this.element.querySelector(".cpr-nd-wounds-drawer");
    const list = drawer?.querySelector(".cpr-nd-wound-list");
    if (!drawer || !list) throw new Error("Unable to refresh the critical wounds drawer.");

    const template = document.createElement("template");
    template.innerHTML = content.trim();
    const updatedList = template.content.querySelector(".cpr-nd-wound-list");
    if (!updatedList) throw new Error("The critical wounds template did not render a wound list.");
    list.replaceWith(updatedList);

    const count = injuries.length;
    const countButton = this.element.querySelector("[data-cpr-nd-action='open-critical-wounds']");
    const drawerLabel = drawer.querySelector(".cpr-nd-drawer-head small");
    if (!countButton || !drawerLabel) throw new Error("Unable to refresh the critical wounds count.");
    countButton.textContent = `${count} WOUNDS OPEN`;
    countButton.classList.toggle("has-open-wounds", count > 0);
    drawerLabel.textContent = `TRAUMA RECORD // ${count} OPEN`;
    this.#positionCriticalWoundsDrawer();
  }

  async #adjustEmpathy(amount) {
    if (!this.isEditable) return;
    const empathy = this.document.system.stats.emp;
    const current = Number(empathy.value) || 0;
    const max = Math.max(0, Number(empathy.max) || 0);
    const value = Math.min(max, Math.max(0, current + amount));
    if (value === current) return;
    await this.document.update({ "system.stats.emp.value": value });
  }

  async #adjustLuck(amount) {
    if (!this.isEditable) return;
    const luck = this.document.system.stats.luck;
    const current = Number(luck.value) || 0;
    const max = Math.max(0, Math.floor(Number(luck.max ?? luck.value) || 0));
    const value = Math.min(max, Math.max(0, current + amount));
    if (value === current) return;
    await this.document.update({ "system.stats.luck.value": value });
  }

  async #roll(target, event, type, title, subtype) {
    target.dataset.rollType = type;
    if (title) target.dataset.rollTitle = title;
    if (subtype) target.dataset.rollSubtype = subtype;
    await this._onRoll({
      currentTarget: target,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      type: event.type,
    });
  }

  #filterSkillsByRank(surface, filter) {
    if (!["all", "trained"].includes(filter)) {
      throw new Error(`Unknown skill filter: ${filter}`);
    }
    this._skillsFilter = filter;

    const filterGroup = surface.querySelector(".cpr-nd-skills-filter");
    for (const button of filterGroup?.querySelectorAll("[data-filter]") ?? []) {
      const active = button.dataset.filter === filter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }

    const groups = surface.querySelector(".cpr-nd-skill-groups");
    if (!groups) return;
    groups.classList.toggle("filter-state-trained", filter === "trained");
    for (const row of groups.querySelectorAll("[data-cpr-nd-skill-row]")) {
      row.hidden = filter === "trained" && Number(row.dataset.rank) === 0;
    }
    for (const group of groups.querySelectorAll("[data-cpr-nd-skill-group]")) {
      group.hidden = !group.querySelector("[data-cpr-nd-skill-row]:not([hidden])");
    }
  }

  #reportError(message, error) {
    console.error(`CPR ND | ${message}`, error);
    ui.notifications.error(game.i18n.localize("CPR.characterSheetND.actionFailed"));
  }
}
