import build_packages as b, common
for m in common.MEALS:
    b.check(m)
    clock = sum(s["minutes"] for s in m["steps"] if s["phase"]!="overlap")
    lv,es,fl,cl,cs,cf,n = m["_d03"]
    print(f'{m["slug"]:42} {lv:9} e{es} {cl:12} c{cs} n{n} total={clock} hh={m["hh001"]}')
