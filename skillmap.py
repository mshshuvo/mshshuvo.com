"""Geometry and view data for the skill map on /experience.

Everything is computed at build time so the page needs no inline styles (CSP style-src 'self'):
positions are SVG attributes, never style="" attributes.
"""
import math
from datetime import date

from content import CAREER_ERAS, CERT_VERIFY, CRED_TILES, SKILL_GROUPS, SKILL_QA, SKILLS

# skill wheel
CX, CY, ORBIT, HUB_R, SECTOR_IN, SECTOR_OUT = 380, 340, 222, 70, 96, 300
VIEWBOX = "75 28 610 622"
# timeline
TL_W, TL_NAME_W, TL_X0, TL_X1, TL_ROW, TL_TOP = 900, 230, 245, 830, 34, 46
TL_START, TL_END = 2010, 2027


def _now() -> float:
    d = date.today()
    return d.year + (d.timetuple().tm_yday - 1) / 366


def resolve(url: str) -> dict:
    """A proof link: internal page, or a certificate's public verification page."""
    if url.startswith("cert:"):
        v = CERT_VERIFY[url[5:]]
        return {"href": v["url"], "verified": True, "via": v["via"]}
    return {"href": url, "verified": False, "via": None}


def _pt(r: float, deg: float) -> tuple[float, float]:
    a = math.radians(deg)
    return CX + r * math.cos(a), CY + r * math.sin(a)


def build(year: int | None = None) -> dict:
    year = year or date.today().year
    order = [g for g, *_ in SKILL_GROUPS]
    skills = sorted(SKILLS, key=lambda s: order.index(s["group"]))  # stable within a group
    labels = {g: (label, means) for g, label, means in SKILL_GROUPS}

    sectors = []
    for i, (g, label, _) in enumerate(SKILL_GROUPS):
        a0, a1 = -150 + i * 120 + 4, -30 + i * 120 - 4
        (x0, y0), (x1, y1) = _pt(SECTOR_OUT, a0), _pt(SECTOR_OUT, a1)
        (xi0, yi0), (xi1, yi1) = _pt(SECTOR_IN, a0), _pt(SECTOR_IN, a1)
        d = (f"M{xi0:.1f},{yi0:.1f} L{x0:.1f},{y0:.1f} A{SECTOR_OUT},{SECTOR_OUT} 0 0 1 {x1:.1f},{y1:.1f} "
             f"L{xi1:.1f},{yi1:.1f} A{SECTOR_IN},{SECTOR_IN} 0 0 0 {xi0:.1f},{yi0:.1f}Z")
        lx, ly = _pt(SECTOR_OUT - 2, [-70, 50, 130][i])  # between two nodes, clear of their labels
        sectors.append({"group": g, "label": label, "d": d, "lx": round(lx, 1), "ly": round(ly + 5, 1)})

    nodes = []
    for k, s in enumerate(skills):
        x, y = _pt(ORBIT, -130 + k * 40)
        years = year - s["since"]
        r = 18 + years * 1.9
        nodes.append({
            "id": f"skill-{k}", "name": s["name"], "group": s["group"], "group_label": labels[s["group"]][0],
            "years": years, "since": s["since"], "plain": s["plain"], "keywords": s["keywords"],
            "proof": [{"label": l.replace(" (verify)", ""), **resolve(u)} for l, u in s["proof"]],
            "x": round(x, 1), "y": round(y, 1), "r": round(r, 1), "halo": round(r + 7, 1),
            "ty": round(y + 7, 1), "ly": round(y + r + 24, 1), "short": s["short"],
        })

    # timeline (one SVG; text keeps its proportions because the aspect ratio is preserved)
    span = TL_X1 - TL_X0
    def tx(v: float) -> float:
        return round(TL_X0 + (v - TL_START) / (TL_END - TL_START) * span, 1)
    now = min(_now(), TL_END)
    eras = [{"label": n, "x": tx(a), "w": round(tx(b or now) - tx(a), 1)} for n, a, b in CAREER_ERAS]
    bars = []
    for i, n in enumerate(sorted(nodes, key=lambda n: (n["since"], order.index(n["group"])))):
        y = TL_TOP + i * TL_ROW
        bars.append({"name": n["name"], "group": n["group"], "years": n["years"], "y": y, "ty": y + 13,
                     "x": tx(n["since"]), "w": round(tx(now) - tx(n["since"]), 1)})
    axis_y = TL_TOP + len(bars) * TL_ROW + 6
    ticks = [{"label": t, "x": tx(t)} for t in range(TL_START, TL_END, 4)]
    grid = [tx(t) for t in range(TL_START, TL_END + 1)]

    return {
        "viewbox": VIEWBOX, "cx": CX, "cy": CY, "hub_r": HUB_R, "groups": SKILL_GROUPS,
        "sectors": sectors, "nodes": nodes, "default": "skill-3",
        "qa": [{"q": q, "a": a, "links": [{"label": l, **resolve(u)} for l, u in links]} for q, a, links in SKILL_QA],
        "creds": [{"code": c, "name": n, "issuer": i, **CERT_VERIFY[k]} for k, c, n, i in CRED_TILES],
        "tl": {"w": TL_W, "h": axis_y + 24, "name_w": TL_NAME_W, "x0": TL_X0, "x1": TL_X1, "eras": eras,
               "bars": bars, "ticks": ticks, "axis_y": axis_y + 14, "grid": grid, "grid_bottom": axis_y,
               "years_x": TL_W - 4},
    }
