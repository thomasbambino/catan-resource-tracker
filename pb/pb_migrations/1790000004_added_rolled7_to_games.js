/// <reference path="../pb_data/types.d.ts" />
// Add a `rolled7_at` field to games — the timestamp (ms) of the most
// recent 7 roll. The client watches this: when it changes and their
// hand is over 7, they auto-open the discard picker. Null when no
// pending 7.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_games_0001");
  collection.fields.add(new Field({
    "hidden": false,
    "id": "number_rolled7_at",
    "max": null,
    "min": 0,
    "name": "rolled7_at",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }));
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_games_0001");
  collection.fields.removeById("number_rolled7_at");
  return app.save(collection);
})
