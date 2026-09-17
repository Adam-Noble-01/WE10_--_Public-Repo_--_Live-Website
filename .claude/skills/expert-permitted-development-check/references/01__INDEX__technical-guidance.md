# Index — MHCLG Technical Guidance (10 September 2019)

Use this to jump straight to the right page. **The guidance is interpretive
only** — see `00__SOURCE-REGISTER.md` §3 for where it is out of date.

**Two local copies of every page:**
- Text — `source/MHCLG__PD-Householder-Technical-Guidance__2019-09-10__FULLTEXT.md`,
  tagged `<!-- ===== PDF PAGE n ===== -->`. PDF page number = printed page number.
- Image — `source/guidance-pages/page-NN.png`. **Open the image when a
  measurement convention is in doubt** — the guidance explains most of them
  through diagrams that the text extraction cannot carry.

To pull one page as text:

```bash
awk '/PDF PAGE 18 =/{p=1;next} /PDF PAGE 19 =/{p=0} p' "MHCLG__PD-Householder-Technical-Guidance__2019-09-10__FULLTEXT.md"
```

---

## Structure of the document

| Pages | Section |
|---|---|
| 1–2 | Cover, Crown copyright / OGL |
| 3 | Contents |
| 4–5 | **Introduction** — status of the guidance, other consent regimes, houses created by Part 3 change of use |
| 6–7 | **General Issues** — defined and undefined terms |
| 8–9 | **The structure of the rules** — how Classes interact when one scheme spans several |
| 10–32 | **Class A** — enlargement, improvement or alteration |
| 33–37 | **Class B** — additions etc to the roof |
| 38–39 | **Class C** — other alterations to the roof |
| 40 | **Class D** — porches |
| 41–46 | **Class E** — buildings etc |
| 47 | **Class F** — hard surfaces |
| 48 | **Class G** — chimneys, flues etc |
| 49–50 | **Class H** — microwave antenna |

**Class AA (additional storeys) is absent** — it postdates this document.

---

## Terms — go here first

| Term | Page | Note |
|---|---|---|
| Terms **defined in the Order** (AONB, WHS, building, cubic content, dwellinghouse, eaves-related, existing, original, terrace house, highway, unadopted street) | **6** | Cross-check against `source/GPDO-2015__Article-2__Interpretation.md` |
| **"Original"** — as at 1 July 1948, or as built if later | **6** | The single most-misapplied term |
| **"Terrace house"** | **6** | Row of 3+; end-of-terrace counts |
| **Sloping ground** | **6, 13** | How height is taken where ground falls |
| **"Curtilage"** | **7** | Not defined in the Order; "part and parcel with the house" |
| **"Enlarged part of the house"** | **7** | |
| **"Total enlargement"** | **7** | Proposed + existing enlargement it joins |
| **"Principal elevation"** | **7, 14–16** | **Only one per house.** Usually fronts the main highway that sets the postcode. Corner plots need a judgement — p.16 |
| Interaction of Classes on one scheme | **8–9** | A two-storey rear extension whose roof joins the main roof engages Class A *and* Class B |

---

## Class A — enlargement, improvement or alteration (pp. 10–32)

| Statute | Topic | Page | Figure |
|---|---|---|---|
| A.1(a) | House created by Part 3 change of use | 10 | |
| A.1(b) | 50% curtilage ground-cover test | 10 | ▣ 10 |
| A.1(c) | Height not to exceed highest part of existing roof | 11 | |
| A.1(d) | Eaves height of the enlarged part | 11–13 | ▣ 12, 13 |
| — | **How eaves are measured** (pitched roof, flat roof + parapet, differing eaves, sloping site) | **12–13** | ▣ **12**, **13** |
| A.1(e) | Extending beyond principal elevation, or a side elevation fronting a highway | 14–16 | ▣ 14, 15, 16 |
| — | Principal elevation on bay-fronted and L-shaped houses | 15 | ▣ 15 |
| — | **Corner plots** — side elevation fronting a highway | 16 | ▣ 16 |
| A.1(f) | Single-storey rear extension — 4 m detached / 3 m other, 4 m height | 17–21 | ▣ 18–21 |
| A.1(g) | **Larger single-storey rear extension** — 8 m / 6 m, neighbour consultation scheme | 17–21 | ▣ 18–21 |
| — | **How the extension beyond the rear wall is measured** (from base of original rear wall to outer edge of extension wall, excluding eaves overhang) | **18** | ▣ **18** |
| — | Rear wall stepped, staggered, or on an L-shaped house | 19–21 | ▣ 19, 20, 21 |
| A.1(h) | More than single storey — 3 m rear limit, 7 m to rear boundary | 21–22 | ▣ 21, 22 |
| A.1(i) | Within 2 m of boundary → 3 m eaves limit | 22 | ▣ 22 |
| A.1(j) | **Side extensions** — 4 m height, single storey, **half the width of the original house** | 22–28 | ▣ 22–28 |
| — | **How "half the width" is measured**, wrap-around cases | **23–28** | ▣ **23–28** |
| A.1(ja) | **Cumulative** — total enlargement including what it joins | 28 | ▣ 28 |
| A.1(k) | Verandah, balcony, raised platform; antenna; chimney/flue/SVP; roof alterations excluded from Class A | 29 | |
| — | Decking — Class E allows up to 0.3 m high | 29 | |
| A.2 | **Article 2(3) land** — cladding, side extensions, two-storey rear all excluded | 30 | |
| A.2(ca) → **cite A.2(d)** | Cumulative limits on article 2(3) land | 30 | |
| A.3(a) | Materials of similar appearance | 31 | |
| A.3(b) | Obscure glazing + 1.7 m opening restriction on side-elevation windows | 31 | |
| A.3(c) | Roof pitch to match where more than single storey | 32 | ▣ 32 |

Neighbour consultation / prior approval procedure: **pp. 4, 8, 17**.

---

## Class B — additions etc to the roof (pp. 33–37)

| Statute | Topic | Page | Figure |
|---|---|---|---|
| B.1(b) | Not above the highest part of the existing roof | 33 | |
| B.1(c) | Not beyond the plane of a roof slope forming the principal elevation and fronting a highway | 33–34 | |
| B.1(d) | **40 m³ terrace / 50 m³ other** — cubic content of resulting roof space | 34 | |
| B.1(e) | Verandah/balcony/raised platform; chimney/flue/SVP | 34 | |
| B.1(f) | **Not on article 2(3) land at all** | 34 | |
| B.2(a) | Materials of similar appearance | 35 | |
| B.2(b)(i) | Eaves maintained/reinstated; **0.2 m set-back** from eaves along the roof slope — except hip-to-gable, or joining to a rear/side extension roof | 35 | ▣ 35 |
| B.2(b)(ii) | No part beyond the outside face of any external wall | 35–36 | ▣ 36 |
| B.2(c) | Obscure glazing + 1.7 m rule, side elevation | 36 | |
| B.3 | "Resulting roof space" includes earlier enlargements | 34 | |
| — | Dormers | 33, 35–36 | ▣ 36 |
| — | Hip-to-gable | 35 | |

---

## Class C — other alterations to the roof (pp. 38–39)

| Statute | Topic | Page | Figure |
|---|---|---|---|
| C.1(b) | **0.15 m protrusion limit** beyond the plane of the *original* roof slope | 38 | ▣ 38 |
| C.1(c) | Not higher than the highest part of the **original** roof — note: Class B measures against the **existing** roof | 39 | |
| C.1(d) | Chimney/flue/SVP and solar excluded from Class C | 39 | |
| C.2 | Obscure glazing + 1.7 m rule for roof-slope windows on a side elevation | 39–40 | |
| — | Rooflights / roof lights | 38 | ▣ 38 |

---

## Class D — porches (p. 40)

| Statute | Topic | Page |
|---|---|---|
| D.1(b) | 3 m² ground area, measured externally | 40 |
| D.1(c) | 3 m maximum height above ground level | 40 |
| D.1(d) | Not within 2 m of a boundary with a highway | 40 |

---

## Class E — buildings etc incidental (pp. 41–46)

| Statute | Topic | Page | Figure |
|---|---|---|---|
| — | What Class E is for; why it is not Class A | 41 | |
| E.1(b) | 50% curtilage ground-cover test | 41 | |
| E.1(c) | Not forward of the principal elevation | 42 | ▣ 42 |
| E.1(d) | Single storey only | 43 | |
| E.1(e) | Height — **4 m dual-pitched / 2.5 m within 2 m of boundary / 3 m otherwise** | 43 | ▣ 43 |
| E.1(f) | 2.5 m eaves | 43 | |
| E.1(g) | **Barred within the curtilage of a listed building** | 44 | |
| E.1(h) | Verandah, balcony, raised platform (>0.3 m) | 44 | |
| E.1(i) | Not a dwelling; not a microwave antenna | 44 | |
| E.1(j) | Oil/LPG container capacity 3,500 litres | 44 | |
| E.2 | **AONB, the Broads, National Park, WHS** — 10 m² cap beyond 20 m from the house | 44 | ▣ 44 |
| E.3 | Article 2(3) land — nothing between a side wall and the boundary | 45 | ▣ 45 |
| E.4 | "Incidental" — includes poultry, bees, pets, livestock | 46–47 | |
| — | **Annexes / sleeping accommodation** — why these fail "incidental" | 46 | |
| — | Decking, swimming pools, garages, outbuildings | 41–44 | |

---

## Classes F, G, H (pp. 47–50)

| Statute | Topic | Page |
|---|---|---|
| F.2 | Hard surface >5 m² between principal elevation and highway → **porous, or run-off directed to a permeable area within the curtilage** | 47 |
| G.1(b) | Chimney/flue/SVP not more than 1 m above the highest part of the roof | 48 |
| G.1(c) | Article 2(3) land — not on a wall/roof slope fronting a highway on the principal or a side elevation | 48 |
| H.1 | Microwave antenna — number, size, siting limits | 49 |
| H.2 | Siting to minimise visual effect; removal when redundant | 50 |
| H.3 | Size criteria; how antenna length is measured | 50 |

---

## Pages carrying diagrams

**10, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 32, 36,
38, 42, 43, 44, 45**

The density between pp. 18–28 is not accidental — those are the rear-extension
measurement and side-extension width rules, which are the hardest to apply from
text alone. Open the PNG.

Regenerate with `scripts/pd_render_guidance_pages.py`.
