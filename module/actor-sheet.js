/**
 * Extend the basic ActorSheet
 * @extends {ActorSheet}
 */


export class YeahNoFerSureActorSheet extends foundry.appv1.sheets.ActorSheet {
	/** @override */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["yeahnofersure", "sheet", "actor"],
			template: "systems/honey-heist/templates/actor-sheet.html",
			width: 750,
			height: 625,
			scrollY: [ "hh-item-list" ],
            dragDrop: [{ dropSelector: null, dragSelector: '[draggable]' }],
			resizable: false
		});
	}

	/** @override */
	getData(options) {
		let baseData = super.getData(options);
		let sheetData = {};
		sheetData = baseData.data;  // needed to handle the new 0.8.x data depth
		sheetData.actor = this.actor.toObject(false);  // needed for actor.x handlebars
		sheetData.editable = this.options.editable;  // needed to fix TinyMCE due to missing editable parameter
		console.debug("Actor Sheet Data:", sheetData)
		return sheetData;
	}

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);

		html.find(".attribute-roll").click(async (ev) => {
			const roller = $(ev.currentTarget);
			const roll = new Roll(roller.data("roll"), this.actor.getRollData());
			await roll.evaluate();
			const parent = roller.parent("div");
			const label = parent.find("label").get(0).innerText;
			const select = parent.find("select").get(0);
			const attributeName = select.name;
			const option = select.options[roll.total - 1];

			await this.actor.update({ [attributeName]: option.value });

			// If you roll an 8 on a hat roll, you get two hats!
			if (attributeName === "data.hat" && roll.total === 9) {
				$(".hat2").show();
				roll.toMessage({
					user: game.user.id,  // avoid deprecation warning, backwards compatible
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					content: `<h2>${label} Roll</h2><h3>${option.innerText} You get two hats!!</h3>`
				});
			} else {
				roll.toMessage({
					user: game.user.id,  // avoid deprecation warning, backwards compatible
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					content: `<h2>${label} Roll</h2><h3>${option.innerText}</h3>`
				});
			}
		});

		html.find(".stat-button").click((ev) => {
			const isYeahNoRoll = this._isYeahNoRoll(ev.currentTarget);
			const updateValue = isYeahNoRoll ? 1 : -1;
			this._updateStatsAsync(updateValue, null, isYeahNoRoll).then((isEnd) => {

				if (!isEnd) {
					ChatMessage.create({
						content: isYeahNoRoll
							? game.i18n.localize("HH.NoYeahToYeahNo")
							: game.i18n.localize("HH.YeahNoToNoYeah"),
						user: game.user.id,
						speaker: ChatMessage.getSpeaker({ actor: this.actor })
					});
				}
			});
		});

		html.find(".stat-roll-single, .stat-roll-double").click(async (ev) => {
			const isYeahNoRoll = this._isYeahNoRoll(ev.currentTarget);
			const roller = $(ev.currentTarget);
			const input = roller.siblings(".stat-value").get(0);
			const currentValue = parseInt(input.value);
			const roll = new Roll(roller.data("roll"), this.actor.getRollData());
			await roll.evaluate();
			const isSuccess = roll.total <= currentValue;
			const rollSuccess = isSuccess ? game.i18n.localize("HH.Success") : game.i18n.localize("HH.Failed");
			const actionMessage = isSuccess
				? game.i18n.localize("HH.PartyHardMessage")
				: game.i18n.localize("HH.ChillOutMessage");
			const chatMessage = isYeahNoRoll
				? `${game.i18n.localize("HH.RollForYeahNo")}: ${rollSuccess}. <p>${actionMessage}</p>`
				: `${game.i18n.localize("HH.RollForNoYeah")}: ${rollSuccess}. <p>${actionMessage}</p?`;

			// FRUSTRATION: When the plan fails and you run into
			// difficulty, move one point from NoYeah into YeahNo.
			// GREED: When the plan goes off without a hitch, move
			// one point from YeahNo into NoYeah.
			const isEnd = await this._updateStatsAsync(isSuccess ? -1 : 1, roll, isYeahNoRoll);
			
			if (!isEnd) {
				roll.toMessage({
					user: game.user.id,  // avoid deprecation warning, backwards compatible
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					flavor: chatMessage
				});
			}
		});

		html.find(".add-item").click(async (ev) => {
			let item = await this.actor.createEmbeddedDocuments("Item", [{type: "item", name: game.i18n.localize('HH.NewItemName')}]);
			await item[0].sheet.render(true);
		});

		html.find(".item-edit").click(async (ev) => {
			const itemID = $(ev.currentTarget).parents("[data-item-id]")[0].dataset.itemId;
			const item = this.actor.items.get(itemID);
			if (item) { item.sheet.render(true); }
		});

		html.find(".item-delete").click(async (ev) => {
			const itemID = $(ev.currentTarget).parents("[data-item-id]")[0].dataset.itemId;
			const item = this.actor.items.get(itemID);

			new Dialog({
				title: `${game.i18n.localize("HH.ConfirmItemDelete")}: ${item.name}`,
				content: game.i18n.localize("HH.ConfirmItemDeleteText"),
				buttons: {
					yes: {
						icon: "<i class='fas fa-check'></i>",
						label: game.i18n.localize("Yes"),
						callback: async (html) => {
							await item.delete();
						}
					},
					no: {
						icon: "<i class='fas fa-times'></i>",
						label: game.i18n.localize("No")
					}
				},
				default: "no"
			}).render(true);
		});

		html.find(".item-roll").click(async (ev) => {
			const itemID = $(ev.currentTarget).parents("[data-item-id]")[0].dataset.itemId;
			const item = this.actor.items.get(itemID);
			const messageData = {
				speaker: ChatMessage.getSpeaker({actor: this.actor}),
				content: `
					<div class="yeahnofersure">
						<div class="chatItem flexrow">
							<div class="item-image" tabindex="0" aria-label="${item.name}" style="background-image: url('${item.img}')"></div>
							<h4>${item.name}</h4>
						</div>
			  		</div>
	  				<div>${item.getRollData().description}</div>`
			}

			await ChatMessage.create(messageData);
		})
	}

	async _updateStatsAsync(offset, roll, isYeahNoRoll) {
		let YeahNoStat = this.actor.system.stats.YeahNo;
		let NoYeahStat = this.actor.system.stats.NoYeah;

		// These stat values should always be numbers, but sometimes 
		// they get returned as strings and I don't know why.
		if (typeof YeahNoStat === "string") {
			YeahNoStat = parseInt(YeahNoStat);
		}

		if (typeof NoYeahStat === "string") {
			NoYeahStat = parseInt(NoYeahStat);
		}

		let endResult = (isYeahNoRoll && YeahNoStat === 6) || (!isYeahNoRoll && NoYeahStat === 6);

		if (!endResult) {
			// Adjust the current values based on the given offset.
			YeahNoStat += offset;
			NoYeahStat -= offset;

			// Only need to check one or the other stat value to make sure they're in the 0-6 range.
			if (YeahNoStat >= 0 && YeahNoStat <= 6) {
				// Set the new values in the sheet.
				await this.actor.update({ "system.stats.YeahNo": YeahNoStat });
				await this.actor.update({ "system.stats.NoYeah": NoYeahStat });

				// Check to see if either the YeahNo or NoYeah stat has reached 6,
				// which means it's the end for this YeahNo.
				if (YeahNoStat === 6) {
					endResult = true;

					if (roll) {
						roll.toMessage({
							user: game.user.id,  // avoid deprecation warning, backwards compatible
							speaker: ChatMessage.getSpeaker({ actor: this.actor }),
							flavor: game.i18n.localize("HH.YeahNoEndMessage")
						});
					} else {
						ChatMessage.create({
							user: game.user.id,  // avoid deprecation warning, backwards compatible
							speaker: ChatMessage.getSpeaker({ actor: this.actor }),
							content: game.i18n.localize("HH.YeahNoEndMessage")
						});
					}
				} else if (NoYeahStat === 6) {
					endResult = true;

					if (roll) {
						roll.toMessage({
							user: game.user.id,  // avoid deprecation warning, backwards compatible
							speaker: ChatMessage.getSpeaker({ actor: this.actor }),
							flavor: game.i18n.localize("HH.NoYeahEndMessage")
						});
					} else {
						ChatMessage.create({
							user: game.user.id,  // avoid deprecation warning, backwards compatible
							speaker: ChatMessage.getSpeaker({ actor: this.actor }),
							content: game.i18n.localize("HH.NoYeahEndMessage")
						});
					}
				}
			}
		}

		return endResult;
	}

	_isYeahNoRoll(element) {
		return element.parentElement.id === "stat-YeahNo";
	}
}
