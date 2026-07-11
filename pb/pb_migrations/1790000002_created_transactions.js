/// <reference path="../pb_data/types.d.ts" />
// Every resource movement in a game. Hands are derived by summing these
// so the log is the single source of truth. `from_party`/`to_party` hold
// either a player id (from the game's players_json) or the literal
// "bank". `resources_json` holds a {brick, lumber, wool, grain, ore}
// bag of what actually moved.
migrate((app) => {
  const collection = new Collection({
    "createRule": "",
    "deleteRule": "",
    "listRule": "",
    "updateRule": "",
    "viewRule": "",
    "name": "transactions",
    "type": "base",
    "system": false,
    "id": "pbc_txns_0001",
    "fields": [
      {
        "cascadeDelete": true,
        "collectionId": "pbc_games_0001",
        "hidden": false,
        "id": "relation_game",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "game",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "text_from_party",
        "max": 60,
        "min": 0,
        "name": "from_party",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "text_to_party",
        "max": 60,
        "min": 0,
        "name": "to_party",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "json_resources",
        "maxSize": 4000,
        "name": "resources_json",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "text_kind",
        "max": 20,
        "min": 0,
        "name": "kind",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "text_note",
        "max": 200,
        "min": 0,
        "name": "note",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
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
      "CREATE INDEX `idx_txns_game` ON `transactions` (`game`, `created`)"
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_txns_0001");
  return app.delete(collection);
})
