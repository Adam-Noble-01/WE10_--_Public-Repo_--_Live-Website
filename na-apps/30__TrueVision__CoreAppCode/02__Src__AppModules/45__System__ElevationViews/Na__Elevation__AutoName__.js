// =============================================================================
// TRUEVISION3D - ELEVATION VIEWS - AUTO NAME
// =============================================================================
//
// FILE       : Na__Elevation__AutoName__.js
// NAMESPACE  : Na__ElevName
// MODULE     : Elevation Views - Auto Name
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Name an elevation from the way it faces against the project's north, until somebody types a name of their own - and say which elevation it is either way
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THE CONTRADICTION THIS REMOVES. An elevation row offered four buttons,
//   North / East / South / West, that set the bearing against the MODEL's -Z
//   axis and called that north. The project's real north is now set in Dev
//   Tools > North Direction, and on PS01 it is 90 degrees round from -Z: the
//   row for the South Elevation showed "West" pressed. The buttons are gone.
//   Which elevation a drawing is, is a FACT - its bearing read against north -
//   and this module states it.
// - THE NAME FOLLOWS THE FACT UNTIL IT IS TYPED OVER. A record carrying
//   Elevation__NameIsAuto is named from its direction - "East Elevation",
//   "North Section" - and renamed when it is turned. Type anything else in the
//   name box ("Coach House East Elevation") and the flag reads false; the name
//   is the author's from then on. Clear the box and it is automatic again. The
//   sentence under the box says which elevation it is in both cases, so a
//   drawing with a name of its own still says what it is a drawing of.
// - NOTHING IS GUESSED. Until north is set there is no compass word, so an
//   automatic name stays whatever it was ("Elevation 3") and the sentence
//   says north has not been set. The flag stays on, and the name arrives the
//   first time the row is opened after north has.
// - RECORDS FROM BEFORE THE FLAG are left alone unless their name is already
//   exactly what this module would give - PS01's three are, lettered by hand
//   to these very words - in which case they are adopted as automatic.
// - A NAME CHOSEN HERE REACHES THE SHEETS. The flag reads false once a name
//   has been typed in this panel, and the Layout Editor's viewport identity
//   then titles that elevation's viewports by the chosen name instead of the
//   compass word - two east elevations on one sheet are otherwise two
//   drawings with one title.
// - The flag is the only new key, it lives on the record, and ValeVision's
//   readers ignore it.
//
// INTEGRATION:
// - Na__Elevation__DevMenu__Editor__ and its row builders call everything here.
// // @delegate: ./Na__Elevation__AutoNameText__.js
// // @delegate: ../46__System__NorthDirection/Na__North__ProjectJson__Data__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported (ValeVision has no north system).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation, for the Elevations menu rebuild.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Project's North, the Records, the Wording
    // ------------------------------------------------------------
    import {
        Na__NorthData__FacingWordForAzimuth,
        Na__NorthData__TrueBearingForAzimuth
    } from '../46__System__NorthDirection/Na__North__ProjectJson__Data__.js';
    import {
        Na__ElevData__GetElevations,
        Na__ElevData__IsSection
    } from './Na__Elevation__ProjectJson__Data__.js';
    import { Na__ElevCfg__GetLabel } from './Na__Elevation__ConfigState__.js';
    import {
        Na__ElevNameText__ComposeName,
        Na__ElevNameText__ComposeStatement,
        Na__ElevNameText__Unique,
        Na__ElevNameText__IsDerivedForm
    } from './Na__Elevation__AutoNameText__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Record Field Names
    // ------------------------------------------------------------
    const Na__ElevName__F_AUTO    = 'Elevation__NameIsAuto';                     // <-- true = named from its direction. false = a name typed in this panel. Absent = a record from before the flag
    const Na__ElevName__F_NAME    = 'Elevation__Name';
    const Na__ElevName__F_ID      = 'Elevation__Id';
    const Na__ElevName__F_AZIMUTH = 'Elevation__AzimuthDeg';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Facts and Wording
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Formats, From Config Where It Gives Them
    // ------------------------------------------------------------
    function Na__ElevName__Formats() {
        return {
            elevationName      : Na__ElevCfg__GetLabel('AutoNameElevationFormat', ''),
            sectionName        : Na__ElevCfg__GetLabel('AutoNameSectionFormat', ''),
            elevationStatement : Na__ElevCfg__GetLabel('FacingStatementElevationFormat', ''),
            sectionStatement   : Na__ElevCfg__GetLabel('FacingStatementSectionFormat', ''),
            northNotSet        : Na__ElevCfg__GetLabel('FacingStatementNorthNotSet', '')
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Names Every OTHER Elevation Holds
    // ------------------------------------------------------------
    function Na__ElevName__OtherNames(elevation) {
        const ownId = elevation ? elevation[Na__ElevName__F_ID] : null;
        return Na__ElevData__GetElevations(null)
            .filter((other) => other[Na__ElevName__F_ID] !== ownId)
            .map((other) => other[Na__ElevName__F_NAME]);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Compass Word an Elevation Is Known By, or ''
    // ------------------------------------------------------------
    function Na__ElevName__FacingWord(elevation) {
        if (!elevation) return '';
        return Na__NorthData__FacingWordForAzimuth(Number(elevation[Na__ElevName__F_AZIMUTH]));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Name Its Direction Gives an Elevation, or '' Until North Is Set
    // ------------------------------------------------------------
    // Unique among the project's elevations: "North Elevation 2" for a second.
    // ------------------------------------------------------------
    function Na__ElevName__Derive(elevation) {
        const base = Na__ElevNameText__ComposeName(
            Na__ElevName__FacingWord(elevation), Na__ElevData__IsSection(elevation), Na__ElevName__Formats()
        );
        return (base === '') ? '' : Na__ElevNameText__Unique(base, Na__ElevName__OtherNames(elevation));
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Elevation This Is, as a Sentence and as Numbers
    // ------------------------------------------------------------
    // Returns { text, known, facing, trueBearingDeg }. trueBearingDeg is the
    // compass bearing of where the viewer stands, null until north is set.
    // ------------------------------------------------------------
    function Na__ElevName__Statement(elevation) {
        const azimuth  = elevation ? Number(elevation[Na__ElevName__F_AZIMUTH]) : NaN;
        const facing   = Na__ElevName__FacingWord(elevation);
        const opposite = Na__NorthData__FacingWordForAzimuth(azimuth + 180);
        const told     = Na__ElevNameText__ComposeStatement(
            facing, opposite, Na__ElevData__IsSection(elevation), Na__ElevName__Formats()
        );
        return {
            text           : told.text,
            known          : told.known,
            facing         : facing,
            trueBearingDeg : Na__NorthData__TrueBearingForAzimuth(azimuth)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Flag and the Name
// -----------------------------------------------------------------------------

    // FUNCTION | Is This Elevation Named From Its Direction
    // ------------------------------------------------------------
    function Na__ElevName__IsAuto(elevation) {
        return Boolean(elevation && elevation[Na__ElevName__F_AUTO] === true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Make a Name Automatic, or the Author's Own
    // ------------------------------------------------------------
    // THREE STATES, NOT TWO. true follows the direction. false says somebody
    // chose this name here, on purpose - which is what lets a sheet's drawing
    // title use it ("PROPOSED COACH HOUSE EAST ELEVATION") rather than the bare
    // compass word. ABSENT is a record from before the flag, about which
    // nothing is known: "Elevation 3" is not a name anybody would want on a
    // title, so an absent flag never promotes a name to one.
    // @delegate: ../51__System__LayoutEditor/20__System__Viewports/Na__LayoutEditor__ViewportIdentity__.js
    // ------------------------------------------------------------
    function Na__ElevName__SetAuto(elevation, isAuto) {
        if (!elevation) return false;
        elevation[Na__ElevName__F_AUTO] = (isAuto === true);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Adopt an Older Record Whose Name Is Already the Automatic One
    // ------------------------------------------------------------
    // Changes no name - only recognises one. Returns true when adopted.
    // ------------------------------------------------------------
    function Na__ElevName__Adopt(elevation) {
        if (!elevation || elevation[Na__ElevName__F_AUTO] !== undefined) return false;   // <-- Only a record nobody has answered for: a chosen name stays chosen
        const base = Na__ElevNameText__ComposeName(
            Na__ElevName__FacingWord(elevation), Na__ElevData__IsSection(elevation), Na__ElevName__Formats()
        );
        if (!Na__ElevNameText__IsDerivedForm(elevation[Na__ElevName__F_NAME], base)) return false;
        return Na__ElevName__SetAuto(elevation, true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Bring an Automatic Name Into Step With the Elevation's Direction
    // ------------------------------------------------------------
    // Returns true when the name changed. Never touches a typed name, and
    // never writes a name while north is not set.
    // ------------------------------------------------------------
    function Na__ElevName__Sync(elevation) {
        if (!Na__ElevName__IsAuto(elevation)) return false;
        const derived = Na__ElevName__Derive(elevation);
        if (derived === '' || derived === elevation[Na__ElevName__F_NAME]) return false;
        elevation[Na__ElevName__F_NAME] = derived;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take What Was Typed in the Name Box
    // ------------------------------------------------------------
    // Empty = back to automatic. The automatic name typed out by hand is the
    // automatic name. Anything else is the author's, and stays.
    // Returns { name, isAuto, changed }.
    // ------------------------------------------------------------
    function Na__ElevName__ApplyTyped(elevation, text) {
        const before  = { name : elevation[Na__ElevName__F_NAME], isAuto : Na__ElevName__IsAuto(elevation) };
        const typed   = (typeof text === 'string') ? text.trim() : '';
        const derived = Na__ElevName__Derive(elevation);

        if (typed === '' || (derived !== '' && typed.toLowerCase() === derived.toLowerCase())) {
            Na__ElevName__SetAuto(elevation, true);
            if (derived !== '') elevation[Na__ElevName__F_NAME] = derived;       // <-- North not set: keep the name it has, and follow north when it arrives
        } else {
            Na__ElevName__SetAuto(elevation, false);
            elevation[Na__ElevName__F_NAME] = typed;
        }

        const isAuto = Na__ElevName__IsAuto(elevation);
        return {
            name    : elevation[Na__ElevName__F_NAME],
            isAuto  : isAuto,
            changed : before.name !== elevation[Na__ElevName__F_NAME] || before.isAuto !== isAuto
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Auto Name API
    // ------------------------------------------------------------
    export {
        Na__ElevName__F_AUTO,
        Na__ElevName__FacingWord,
        Na__ElevName__Derive,
        Na__ElevName__Statement,
        Na__ElevName__IsAuto,
        Na__ElevName__SetAuto,
        Na__ElevName__Adopt,
        Na__ElevName__Sync,
        Na__ElevName__ApplyTyped
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
