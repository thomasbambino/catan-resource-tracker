/// <reference path="../pb_data/types.d.ts" />
// A game (one Catan session). The player roster is stored inline as JSON
// so it's always fetched with the game and edited as a unit. `banker`
// holds the player id of whoever is authorized to move other players'
// cards, deal from the bank, and resolve the robber.
migrate((app) => {
  const collection = new Collection({
    "createRule": "",
    "deleteRule": "",
    "listRule": "",
    "updateRule": "",
    "viewRule": "",
    "name": "games",
    "type": "base",
    "system": false,
    "id": "pbc_games_0001",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "text1579384326",
        "max": 200,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "date473765221",
        "max": "",
        "min": "",
        "name": "ended_at",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "json4181650261",
        "maxSize": 200000,
        "name": "players_json",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "json"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_banker",
        "max": 100,
        "min": 0,
        "name": "banker",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": true,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": true,
        "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX `idx_games_created` ON `games` (`created`)"
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_games_0001");
  return app.delete(collection);
})
