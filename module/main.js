import { YeahNoFerSureActor } from "./actor.js";
import { YeahNoFerSureActorSheet } from "./actor-sheet.js";
import { YeahNoFerSureItemSheet } from "./item-sheet.js";

Hooks.once("init", async function () {
	console.log(`YeahNoFerSure: Initializing`);

	// Define custom Entity classes
	if (foundry.utils.isNewerVersion(game.data.version, "0.8.0")) {
		CONFIG.Actor.documentClass = YeahNoFerSureActor;
	} else {
		CONFIG.Actor.entityClass = YeahNoFerSureActor;
	}

	// Register sheet application classes
	foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
	foundry.documents.collections.Actors.registerSheet("YeahNoFerSure", YeahNoFerSureActorSheet, { label: "Yeah No Fer Sure Character Sheet (Default)", makeDefault: true });

	foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
	foundry.documents.collections.Items.registerSheet("YeahNoFerSure", YeahNoFerSureItemSheet, { label: "Yeah No Fer Sure Item Sheet (Default)", makeDefault: true });

	Handlebars.registerHelper("removeProperty", function (obj, property) {
		delete obj[property];
		return obj;
	});

	// CONFIG.debug.hooks = true;
});

Hooks.once("ready", async function () {
	// Make sure all roll tables are always present.
	const existingRollTables = [];
	const rollTablesToAdd = [];
	const rollTables = {
		Organizer: "/systems/honey-heist/resources/roll-tables/fvtt-RollTable-Organizer.json",
		Setting: "/systems/honey-heist/resources/roll-tables/fvtt-RollTable-Setting.json",
		Location: "/systems/honey-heist/resources/roll-tables/fvtt-RollTable-Location.json",
		Prize: "/systems/honey-heist/resources/roll-tables/fvtt-RollTable-Prize.json",
		Security: "/systems/honey-heist/resources/roll-tables/fvtt-RollTable-Security.json",
		Twist: "/systems/honey-heist/resources/roll-tables/fvtt-RollTable-Twist.json"
	};

	if (foundry.utils.isNewerVersion(game.data.version, "0.8.0")) {
		for (const document of game.collections.get("RollTable").contents) {
			existingRollTables.push(document.name);
		}
	} else {
		for (const document of RollTable.collection.entities) {
			existingRollTables.push(document.name);
		}
	}

	for (let [key, value] of Object.entries(rollTables)) {
		if (existingRollTables.indexOf(key) === -1) {
			const rollTable = await $.getJSON(value).then();
			rollTablesToAdd.push(rollTable);
		}
	}

	RollTable.create(rollTablesToAdd);
});

Hooks.on("renderYeahNoFerSureActorSheet", (ev) => {
	// Color a stat red if it's value is six.
	const root = ev.element[0];
	const yeahNoStatElement = root.querySelector("#stat-yeah-no .stat-value");
	const noYeahStatElement = root.querySelector("#stat-no-yeah .stat-value");
	let yeahNoVal = parseInt(yeahNoStatElement.value, 10);
	let noYeahVal = parseInt(noYeahStatElement.value, 10);

	if (yeahNoVal === 6) {
		yeahNoStatElement.classList.add("error-red");
	} else if (noYeahVal === 6) {
		noYeahStatElement.classList.add("error-red");
	}
});
