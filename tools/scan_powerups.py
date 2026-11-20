"""Check every published book follows the power-up rule: the n-th power-up since the last reset\n(base spin or bonus start) is the n-th in the fixed order and fires at >= 25*n damage; none\nskipped. Run from the publish_files folder:  ../../../../env/bin/python ../../../../../tools/scan_powerups.py <mode>"""
import sys, io, json, zstandard
ORDER = ["symbolsToWild", "wildBlock", "lowSymbolsToWild", "symbolBlock", "dualSymbolsToWild", "highSymbolBlock", "dualLowSymbolsToWild", "bossSlain"]
mode = sys.argv[1]
bad = 0; books = 0; fired_total = 0; slain = 0; first = []
with open(f"books_{mode}.jsonl.zst", "rb") as f:
    for line in io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(f)):
        b = json.loads(line); books += 1
        dmg = 0; fired = 0
        def fail(msg):
            global bad
            bad += 1
            if len(first) < 5: first.append((b["id"], msg))
        for e in b["events"]:
            t = e["type"]
            if (t == "reveal" and e.get("gameType") == "basegame") or t == "selectedMode":
                dmg = 0; fired = 0
            elif t == "featureEvent" and e["featureType"] == "damage":
                d = e["info"][0]["damage"]
                if d < dmg: fail(f"damage went down {dmg}->{d}")
                if fired < min(8, dmg // 25): fail(f"power-up missing before damage {d} (had {dmg}, fired {fired})")
                dmg = d
            elif t == "featureEvent" and e["featureType"] == "bossFeature":
                info = e["info"][0]
                if fired >= 8: fail("more than 8 power-ups"); continue
                if info["feature"] != ORDER[fired]: fail(f"order: got {info['feature']} expected {ORDER[fired]}")
                if info["damage"] < 25 * (fired + 1): fail(f"{info['feature']} at {info['damage']} < {25*(fired+1)}")
                fired += 1; fired_total += 1
                if info["feature"] == "bossSlain": slain += 1
        if fired < min(8, dmg // 25) and not any(e["type"] == "wincap" for e in b["events"]):
            fail(f"round ended with {dmg} damage but only {fired} power-ups")
print(f"{mode:13s} books {books:6d}  power-ups {fired_total:8d}  slain {slain:6d}  violations {bad}  {first}")
