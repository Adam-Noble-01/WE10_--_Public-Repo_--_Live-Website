# Source Register — read this before relying on any source

Two primary sources sit behind every appraisal. They are **not** equal in
authority, and they **do not** currently say the same thing.

---

## 1. The law (operative)

**The Town and Country Planning (General Permitted Development) (England)
Order 2015 (S.I. 2015/596), as amended.**

This *is* the permitted development right. Article 3(1) grants planning
permission for the classes of development described in Schedule 2. Everything
else is commentary.

| Snapshot file | Covers | Primary URL |
|---|---|---|
| `source/GPDO-2015__Article-2__Interpretation.md` | Defined terms — `original`, `existing`, `dwellinghouse`, `building`, `cubic content`, `listed building`, `SSSI`, `AONB`, `World Heritage Site` | https://www.legislation.gov.uk/uksi/2015/596/article/2 |
| `source/GPDO-2015__Article-3__Permission-granted.md` | The grant itself, and its overrides — art 3(4) conditions, art 3(5) unlawful buildings, art 3(6) highway visibility | https://www.legislation.gov.uk/uksi/2015/596/article/3 |
| `source/GPDO-2015__Article-4__Article-4-directions.md` | Withdrawal of rights by direction | https://www.legislation.gov.uk/uksi/2015/596/article/4 |
| `source/GPDO-2015__Sch1__Article-2(3)-land.md` | What "article 2(3) land" and "article 2(4) land" mean | https://www.legislation.gov.uk/uksi/2015/596/schedule/1 |
| `source/GPDO-2015__Sch2-Part-1__Householder.md` | **Classes A, AA, B, C, D, E, F, G, H** — the core | https://www.legislation.gov.uk/uksi/2015/596/schedule/2/part/1 |
| `source/GPDO-2015__Sch2-Part-2__Minor-operations.md` | Fences/gates/walls, means of access, exterior painting, EV charging | https://www.legislation.gov.uk/uksi/2015/596/schedule/2/part/2 |
| `source/GPDO-2015__Sch2-Part-14__Renewable-energy.md` | Solar PV/thermal, heat pumps, biomass flues, wind turbines | https://www.legislation.gov.uk/uksi/2015/596/schedule/2/part/14 |
| `source/GPDO-2015__Sch2-Part-20__New-dwellinghouses.md` | Referenced by the Part 1 exclusions | https://www.legislation.gov.uk/uksi/2015/596/schedule/2/part/20 |

- **Snapshot taken:** 17-Sep-2026
- **Version:** latest available revised text published by The National Archives
- **Status at capture:** every part reported *"There are currently no known
  outstanding effects"*. The revised text was therefore up to date on that date.
- **Currency evidence:** the snapshot carries amendments in force to
  **9 April 2026** (Class AA paras AA.3(11)(b) and AA.3(12)(b) omitted), and
  Part 14 Class A already includes plug-in solar and balcony enclosures.

Re-pull at any time with `scripts/pd_fetch_legislation.py`. It reprints the
status banner; **if it ever reports outstanding effects, the snapshot is behind
the law** — check the amending instrument before appraising.

---

## 2. The guidance (interpretive only)

**"Permitted development rights for householders — Technical Guidance",
Ministry of Housing, Communities and Local Government.**

| | |
|---|---|
| Landing page | https://www.gov.uk/government/publications/permitted-development-rights-for-householders-technical-guidance |
| PDF | https://assets.publishing.service.gov.uk/media/5d77afc8e5274a27cdb2c9e9/190910_Tech_Guide_for_publishing.pdf |
| First published | 13 April 2016 |
| **Last updated** | **10 September 2019** |
| Extent | 50 pages, 487 KB |
| SHA-256 | `c034f050d0d0b5df64ca8dbaabbd94bf6dd48f0709dc3c50b5fced9658f2be3f` |
| Licence | Crown copyright 2019, Open Government Licence v3.0 |
| Local copies | `source/MHCLG__PD-Householder-Technical-Guidance__2019-09-10.pdf`<br>`source/...__FULLTEXT.md` (page-tagged text)<br>`source/guidance-pages/page-NN.png` (all 50 pages rendered) |

### There is no 2026 edition — this was checked, not assumed

GOV.UK's own change history for this publication reads, in full:

> 10 September 2019 — Added updated guidance.
> 6 April 2017 — Added updated guidance.
> 13 April 2016 — First published.

Searches for a 2024, 2025 or 2026 edition return nothing. **The 10 September
2019 version is the current and only edition.** It is now roughly seven years
behind the legislation it describes.

The guidance itself acknowledges its status (p.4): diagrams are "for
illustrative purposes only and these are not drawn to scale", the guide "cannot
cover all possible situations", and where there is doubt, advice should be
sought from the local planning authority or a Lawful Development Certificate
obtained.

---

## 3. Verified divergences — guidance (2019) vs law (2026)

Each entry below was checked line-by-line against both snapshots. **Where they
differ, the law governs.**

### 3.1 Class AA does not exist in the guidance

Class AA — enlargement of a dwellinghouse by construction of up to two
additional storeys — was inserted on **31 August 2020 at 9.00 a.m.** by
S.I. 2020/755, art 3(2). The 2019 guidance predates it entirely: there is no
Class AA section, and the contents page runs A, B, C, D, E, F, G, H only.

**Consequence:** for any upward extension, the guidance offers *nothing*. Work
solely from the statute and `11__CHECKS__class-aa-additional-storeys.md`.

### 3.2 The Part 20 exclusion is missing from every Class

A Part 1 right is now unavailable where the dwellinghouse was itself built
under Part 20 (construction of new dwellinghouses). Inserted 1 August 2020 by
S.I. 2020/632:

| Sub-paragraph | Inserted by |
|---|---|
| A.1(l) | reg 5(a)(iii) |
| B.1(g) | reg 6(a)(iii) |
| C.1(e) | reg 7(c) |
| D.1(e) | reg 8(c) |
| E.1(k) | reg 9(c) |
| F.1(b), G.1(d), H.1(f) | same instrument |

None of these appear in the 2019 guidance.

### 3.3 The change-of-use exclusion list is short in the guidance

The guidance (e.g. p.40, Class D) reads *"Class M, N, P, PA or Q"*. The current
law reads **"Class G, M, MA, N, P, PA or Q"** — and Class AA adds **O**.

| Addition | In force | Instrument |
|---|---|---|
| `PA` | 6 April 2016 | S.I. 2016/332, art 9 |
| `MA` | 21 April 2021 | S.I. 2021/428, art 4 |
| `G` | 1 August 2021 | S.I. 2021/814, art 3(2) |

**Consequence:** a house created under Class G or Class MA has **no** Part 1
rights, and the 2019 guidance will not tell you that.

### 3.4 Class B is lost once Class AA has been used

B.1(h) — Class B unavailable where the house has been enlarged in reliance on
Class AA — inserted 31 August 2020 by S.I. 2020/755, art 3(3)(b). Absent from
the guidance.

### 3.5 Renumbering: A.2(ca) became A.2(d)

The fourth article 2(3) land restriction (cumulative total enlargement) is
labelled **(ca)** at guidance p.30 and **(d)** in the current statute. Same
substance; cite **A.2(d)**.

### 3.6 Class A.3(c) roof-pitch condition

Substituted 6 April 2017 by S.I. 2017/391, art 3(c). The guidance text at p.32
reflects the substituted wording, but check the statute before quoting.

---

## 4. Other consent regimes — never fold these into a PD verdict

Permitted development is *planning permission only*. It does not touch:

- **Listed building consent** — needed for works to a listed building
  regardless of PD, and Class E is barred outright in a listed building's
  curtilage (E.1(g)).
- **Building regulations** and the **Party Wall etc. Act 1996** — expressly
  reserved by the guidance at p.4.
- **Protected species / biodiversity**, **highways consent**, **tree
  preservation orders**, **restrictive covenants**, **flood risk consents**.
- **Article 4 directions** and **planning conditions** removing PD rights —
  these *do* defeat PD, and must be checked at Step 0.

---

## 5. Useful GOV.UK guidance (secondary, not authority)

- Planning Practice Guidance, "When is permission required?" —
  https://www.gov.uk/guidance/when-is-permission-required
- Lawful Development Certificates —
  https://www.gov.uk/guidance/lawful-development-certificates

Cite these as supporting material only. The GPDO remains the authority.
