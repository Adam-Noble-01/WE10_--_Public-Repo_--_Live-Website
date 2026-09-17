# Index — GPDO 2015 snapshots (the operative text)

Line numbers are into the files in `references/source/`, snapshot 17-Sep-2026.
**Line numbers shift if the snapshot is refreshed** — if a jump lands in the
wrong place, re-grep rather than trusting the number:

```bash
grep -n "^A.1 " "GPDO-2015__Sch2-Part-1__Householder.md"
```

Read a specific class:

```bash
sed -n '237,450p' "GPDO-2015__Sch2-Part-1__Householder.md"      # Class AA
```

Strip the editorial footnotes when you only want the operative wording:

```bash
sed -n '23,236p' "GPDO-2015__Sch2-Part-1__Householder.md" | grep -vE "^F[0-9]+ |^I[0-9]+ |^Textual Amendments$|^Commencement Information$"
```

Keep the `F…` notes when you need to know **when** a provision changed — that is
how the divergences in `00__SOURCE-REGISTER.md` were proved.

---

## `GPDO-2015__Sch2-Part-1__Householder.md` — the core

| Line | Provision | What it does |
|---|---|---|
| 21 | PART 1 heading | Development within the curtilage of a dwellinghouse |
| **23** | **Class A** | Enlargement, improvement or other alteration |
| 31 | A.1 | Development **not** permitted — (a) change-of-use origin · (b) 50% curtilage · (c) height v. existing roof · (d) eaves · (e) beyond principal / highway-fronting side elevation · (f) single-storey rear 4 m/3 m + 4 m high · (g) larger rear 8 m/6 m · (h) multi-storey rear 3 m + 7 m to boundary · (i) within 2 m of boundary → 3 m eaves · (j) side extension · (ja) cumulative · (k) verandah/balcony/platform, antenna, flue, roof alteration · (l) Part 20 house |
| 109 | A.2 | **Article 2(3) land** — cladding, side extension, two-storey rear, cumulative |
| 125 | A.3 | **Conditions** — (a) similar materials · (b) obscure glazing + 1.7 m · (c) roof pitch |
| 141 | A.4 | **Larger home extension: neighbour consultation / prior approval procedure** (applies where A.1(f) is exceeded but A.1(g) allows it) |
| **237** | **Class AA** | Enlargement by additional storeys |
| 245 | AA. | The right — up to 2 storeys (house of 2+ storeys), 1 storey (single-storey house) |
| 255 | AA.1 | Not permitted — (a) change-of-use origin · (b) article 2(3) land or SSSI · (c) built before 1 Jul 1948 or after 28 Oct 2018 · (d) already extended upward · (e) 18 m overall cap · (f) +3.5 m / +7 m cap · (g) non-detached +3.5 m v. neighbours · (h) 3 m floor-to-ceiling cap · (i) principal part only · (j) no visible support structures · (k) engineering ops limited |
| 303 | AA.2 | **Conditions** — materials, no side-elevation window, roof pitch, C3 use; **prior approval required**; construction management report; 3-year completion; completion notification |
| 347 | AA.3 | Prior approval procedure — what must accompany the application (incl. scaled plans, north point, existing/proposed elevations, window positions) |
| 421 | AA4 | Interpretation — `detached`, `principal part`, `semi-detached`, `terrace house`, what counts as a `storey` |
| **451** | **Class B** | Additions etc to the roof |
| 459 | B.1 | Not permitted — (b) above existing roof · (c) beyond principal-elevation roof plane fronting a highway · (d) **40 m³ terrace / 50 m³ other** · (e) verandah/balcony/platform, flue · (f) **article 2(3) land** · (g) Part 20 house · (h) **Class AA already used** |
| 505 | B.2 | Conditions — materials; eaves maintained + **0.2 m set-back**; no part beyond external wall face; obscure glazing + 1.7 m |
| 527 | B.3 | "Resulting roof space" includes earlier enlargements |
| 529 | B.4 | Minor roof details excluded; "rear or side extension" defined |
| **539** | **Class C** | Other alterations to the roof |
| 547 | C.1 | Not permitted — (b) **0.15 m** protrusion beyond original roof plane · (c) above highest part of **original** roof · (d) flue / solar excluded · (e) Part 20 house |
| 579 | C.2 | Condition — obscure glazing + 1.7 m for side-elevation roof windows |
| **585** | **Class D** | Porches |
| 593 | D.1 | Not permitted — (b) **3 m²** external ground area · (c) **3 m** height · (d) within **2 m** of a highway boundary · (e) Part 20 house |
| **619** | **Class E** | Buildings etc incidental |
| 631 | E.1 | Not permitted — (b) 50% curtilage · (c) forward of principal elevation · (d) more than single storey · (e) **4 m dual-pitch / 2.5 m within 2 m of boundary / 3 m otherwise** · (f) **2.5 m eaves** · (g) **curtilage of a listed building** · (h) verandah/balcony/platform · (i) a dwelling or antenna · (j) 3,500 l container · (k) Part 20 house |
| 675 | E.2 | AONB / the Broads / National Park / WHS — **10 m² cap beyond 20 m from any wall** |
| 687 | E.3 | Article 2(3) land — nothing between a side wall and the boundary |
| 689 | E.4 | "Incidental" includes poultry, bees, pets, livestock |
| **693** | **Class F** | Hard surfaces |
| 705 | F.1 | Not permitted — (a) change-of-use origin · (b) Part 20 house |
| 721 | F.2 | Condition — >5 m² in front of the principal elevation must be porous **or** drain to a permeable surface within the curtilage |
| **729** | **Class G** | Chimneys, flues, soil and vent pipes |
| 737 | G.1 | Not permitted — (b) **1 m** above the highest part of the roof · (c) article 2(3) land, highway-fronting principal/side elevation · (d) Part 20 house |
| **765** | **Class H** | Microwave antenna |
| 773 | H.1 | Number, length, cubic capacity, siting, article 2(3) land limits |
| 821 | H.2 | Conditions — minimise visual effect; remove when redundant |
| 829 | H.3 | Size criteria; how length is measured |
| **841** | **Interpretation of Part 1** | `highway` (**includes an unadopted street or private way**), `raised` (**>0.3 m**), `terrace house` |

---

## `GPDO-2015__Article-2__Interpretation.md` — defined terms

| Line | Term | Why it matters |
|---|---|---|
| 45 | area of outstanding natural beauty | article 2(3) land |
| 47 | **building** | Includes any structure or erection **and any part of a building**; excludes plant, machinery, and (in Sch 2) gates, fences, walls and other means of enclosure |
| 57 | classified road | art 3(6) highway-access restriction |
| 63 | **cubic content** | **Measured externally** — the Class B 40/50 m³ test |
| 65 | **dwellinghouse** | **Excludes flats and buildings containing flats** — no Part 1 rights |
| 69 | erection | Includes extension, alteration, re-erection |
| 71 | **existing** | Immediately before the development — contrast `original` |
| 73 | flat | Divided horizontally from another part of the building |
| 89 | listed building | s.1 Planning (LBCA) Act 1990 |
| **139** | **original** | **As at 1 July 1948, or as built if built later.** The base for every cumulative allowance |
| 151 | private way | Feeds the Part 1 `highway` definition |
| 187 | site of special scientific interest | Defeats A.1(g) and Class AA |
| 213 | trunk road | art 3(6) |
| 217 | World Heritage Site | article 2(3) land |

---

## `GPDO-2015__Article-3__Permission-granted.md`

| Provision | Effect |
|---|---|
| 3(1)–(2) | The grant, subject to every exception, limitation and condition in Schedule 2 |
| **3(4)** | **Nothing permits development contrary to a condition on a planning permission** — the standard estate/barn-conversion PD stripper |
| **3(5)** | **No PD attaching to unlawful building operations or an unlawful use** |
| 3(6) | No new/widened access to a trunk or classified road; no obstruction of highway visibility likely to cause danger |
| 3(9) | Schedule 2 does not permit demolition of a building (part of a building excepted) |
| 3(10)–(12) | EIA development is not permitted without a negative screening opinion/direction |

## `GPDO-2015__Sch1__Article-2(3)-land.md`

**Article 2(3) land** = conservation area · area of outstanding natural beauty ·
s.41(3) WCA 1981 area · the Broads · National Park · World Heritage Site.

## `GPDO-2015__Article-4__Article-4-directions.md`

How a local planning authority withdraws named rights over named land. **Always
check whether one applies** — it is invisible on a drawing.

---

## Ancillary parts

### `GPDO-2015__Sch2-Part-2__Minor-operations.md`

| Line | Provision |
|---|---|
| 23 | **Class A — gates, fences, walls, other means of enclosure** |
| 31 | A.1 — **1 m** adjacent to a highway used by vehicular traffic (2 m for a school); **2 m** elsewhere; no increase above former height; **not within the curtilage of, or to an enclosure around, a listed building** |
| 53 | Class B — means of access to a highway (not trunk/classified) |
| 59 | **Class C — exterior painting** (C.1 excludes advertisement; C.2 "painting" includes any application of colour) |
| 81 | Class D — electrical outlet for recharging vehicles |
| 103 | Class E — electrical upstand for recharging vehicles |

### `GPDO-2015__Sch2-Part-14__Renewable-energy.md`

| Line | Provision |
|---|---|
| 23 | **Class A — solar PV / solar thermal on domestic premises** |
| 37 | A.1(1) — limits for a **block of flats** |
| **55** | A.1(2) — limits for a **dwellinghouse**: 0.2 m protrusion where the wall abuts a highway / 0.4 m otherwise; pitched roof 0.2 m and not above the ridge (chimney excluded); **flat roof 0.6 m**; conservation area / WHS — not on a highway-fronting wall, balcony or roof enclosure; not on a scheduled monument; **not on a listed building** |
| 107 | A.2 — conditions: site to minimise visual effect; remove when no longer needed |
| 125 | Class B — stand-alone solar on domestic premises |
| 247 | Class C — ground source heat pumps |
| 253 | Class D — water source heat pumps |
| 259 | Class E — biomass flue |
| 273 | Class F — CHP flue |
| **287** | **Class G — air source heat pumps on domestic premises** |
| 299 | G.1 — must comply with the **MCS Planning Standards** |
| 305 | G.2 — siting and size limits |
| 359 | G.3 — conditions |
| 377 | Class H — wind turbine on domestic premises |
| 805 | Interpretation of Part 14 |

Part 14 is amended frequently. **Always read it fresh — never from memory.**
