# Dorm inspection correction — campus-77

## Reference and scope

Rechecked local frames from the user-supplied BV1otWu6EEu9 inspection clip (00:15, 00:16, 00:18, 00:19) and the older BV1LsWj6eEEU footage (around 1750 / 1830 / 1880 seconds). The latest inspection room visibly has side-wall bunks, a narrow central aisle, gray terrazzo, a small table with a turquoise thermos, pale wood, bed-head cupboards, towels and a window with blue curtains. The older wooden-floor variant is not combined with this room.

These are interval-frame observations, not a full surveyed floor plan. Six bunk frames / twelve places are the current playable reconstruction capacity. Exact total bed count, dimensions, unseen rooms and exterior circulation are not established by the available frames. This is not a 1:1 acceptance claim.

## Implemented and rendered

- Removed the old three-column, 24-place classroom-sized dorm arrangement.
- Separate narrower room shell and ceiling, two wall-side bunk rows, central aisle/table, end window, curtains, AC, wood grain, cloth and terrazzo surfaces.
- Classroom walls, ceiling, windows and front door no longer leak into the dorm. The old front-door area is closed; the rear entrance remains connected to the existing corridor.
- Rotated bed positions, cupboards, ladder targets, get-off positions, physical furniture volumes and cupboard-door motion together.
- Cupboard doors face the bed head and clear end rails through their complete swing; upper and lower storage stay independent.
- Real browser testing exposed an inaccessible upper-bunk target buried inside the solid platform. The visible ladder now provides the upper-bed interaction target without disabling obstruction tests.
- Real browser testing exposed old global-X offsets and a quarter-turn error for sleeping pupils. Feet/head now follow each bunk's long axis, head reaches the pillow, face points towards the aisle.
- Restored face shapes and the user's six authored first-person clips are unchanged.

## Verification

- Complete regression before the final sleeping-placement correction: 1070 / 1070 pass, no skips, `/private/tmp/campus77-all-verified.log`.
- Final sleeping-placement, bunk collision/rules and locomotion checks: 22 / 22 pass, `/private/tmp/dorm77-body-final.log`.
- Lower bunk: selected, mounted, cupboard opened, visible drink selected and removed from shelf by the real E interaction.
- Upper bunk: ladder selected, mounted, separate cupboard opened, closed with Q, get-off returned to a standing position.
- All twelve bed approaches traversed against real walking collision; cupboard render/collider bounds compared throughout the swing. Upper ladder ray targets are tested against actual solid geometry.
- Inspection view with sleeping pupils rendered and reviewed. Local proof: `/private/tmp/campus77-dorm-inspection.png`; upper cupboard proof: `/private/tmp/campus77-dorm-upper.png`.
- Two obsolete roof tests were updated to use a point inside the new dorm and its actual 3.45 m ceiling, instead of the removed classroom center at x=0. Indoor roof collision assertions remain in place.

Night remains dark and the teacher's flashlight is retained. New surfaces and furniture were inspected on desktop; no claim of real-phone FPS, exact source animation, or public multiplayer availability is made.
