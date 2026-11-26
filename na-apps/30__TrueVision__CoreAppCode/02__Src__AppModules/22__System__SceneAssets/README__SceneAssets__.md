# 22__System__SceneAssets

What people and plants share since staff can place them: the page's side of who did what, the Changes section, and the panel on the left as dropdown sections (v2.91.0). Adam, 05-Nov-2026: "Employees should be able to create entourage and foliage. So we need a system and way of tracking ownership of those assets and changes, so who inserted what etc".

## In TrueVision

TrueVision has one author and no server keeping who did what, so this folder is the shared panel (`Na__SceneAssets__Hub__.js`
and its styles) and the save: `Na__SceneAssets__Api__.js` is TrueVision's own, with ValeVision's four calls and one more,
`RemoveAll`. A save goes straight into `TrueVision__ProjectData__.json`: R2 first through the Worker, then the local copy,
refused if R2 changed since the window read it. `summary` is always null, so neither panel shows a Change Log and a
right-click has no who-added-it line; `Approve` and `Revert` answer that there is nothing to approve or put back.
`Na__SceneAssets__ChangesPanel__.js` stays for its helpers, which say nothing with no summary. Ported at TrueVision
v2.185.0 (15-Nov-2026); everything below is ValeVision's.

## How It Stands (in ValeVision)

**Built, v2.89.0.** The sums are on the server, in `Server__Api/Api__ValeVision3D/ValeVision3D__Api__SceneAssets__Logic__.py`, whose header is the place to start. This folder only carries the words and draws the tab.

- **No approval since v2.96.0.** Adam, 11-Nov-2026: "Remove this, any entorage added by anyone staff or above should be updated when saved". A save by any staff member, and their own Remove My Changes, go straight into the record, and a save publishes anything left waiting from before. The switch is `NA_STAFF_SAVES_GO_STRAIGHT_IN` in the Logic file; False brings back the wait for an admin. Line rules, Enabled and the other settings stay an admin's.
- **The record is all a client ever reads.** Who did what sits beside it, in `<project>/ValeVision3D/UserData__SceneAssets/ValeVision__SceneAssets__Changes__.json`. Staff work on the two laid together.
- **Who added it and when** (`Owners` in that file) is shown on the right-click menu of every person and plant (`Na__SceneChanges__OwnerLines`), for "ownership / accountability".
- **The item is the unit:** a figure, a plop, a path or a palette, by its Uid.
- **Removing someone's changes** puts each item back as it stood just before they first touched it, except one somebody else has changed since.

## Who Gets What

| Who | Page asks | Server asks | What |
|---|---|---|---|
| A client link, an Affiliate | Neither below | Refused | Reads the record. The section shows only with something placed |
| Staff on a phone | `Na__DevGate__IsStaff` | Employee | Looks. No rows to place with |
| Staff on a computer or tablet | `Na__DevGate__CanCreateAssets` | Employee | Places, saves (straight in), removes their own |
| An AppAdmin | `Na__DevGate__IsAuthoringEnabled` | `AUTHOR_LEVEL` | Removes anyone's, line rules, the off switch; Approve for work left waiting from before v2.96.0 |

## Files

| File | Namespace | What |
|---|---|---|
| `Na__SceneAssets__Api__.js` | `Na__SceneApi` | The four routes. Never rejects: every call resolves to `{ ok, error, ... }` |
| `Na__SceneAssets__ChangesPanel__.js` | `Na__SceneChanges` | The Changes section each panel draws, the who line on a row, the icons |
| `Na__SceneAssets__Hub__.js` | `Na__SceneHub` | The Vegetation and Entourage panels' dropdown sections, in the manner of Tools & Settings: one open at a time, each made when it opens and taken down when it folds (v2.91.0) |
| `Na__SceneAssets__InfoTip__.js` | `Na__SceneInfo` | The (i) info icon whose delayed hover tooltip holds a panel's or tool's standing instructions, so no paragraph of notes shows (Adam, 26-Nov-2026: "no overwhelming notes in the UI"). Put it at the right end of a row (v2.189.8, from ValeVision 3D) |
| `Na__SceneAssets__Styles__.css` | | Icons on rows, who did what, the panel's dropdown sections (the old tab and fold rules stay, unused) |

Each system's data module (`Na__EntData`, `Na__VegData`) calls the routes and keeps the object, and each system's shell brings the picture, the undo steps and the panels into line when the server's answer changes it (`AfterReplaced`).

## Rules That Bite

- **`scene-assets` must never join `CLIENT_READ_ENDPOINTS`.** Its answers hold staff names.
- **A route's last segment is fixed,** and it resolves through `resolve_project_exact`: note 14, section 3.
- **It stays the one object.** Everything holds the same object, so `TakeAnswer` replaces its contents and never the object.
- **A key outside the item lists is an admin's.** Add a new setting freely: an Employee's is ignored. Add a new list of items to `NA_SYSTEMS` in the Logic file, or an Employee's work in it is not saved.
- **A testing server reads the API once.** After changing the Logic or route file, test on a testing server started after the change: one already running answers with the old code (no `published` in a save's answer).
