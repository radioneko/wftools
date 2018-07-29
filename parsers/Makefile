DROPTBL := droptables.html
POOLJS := ../wftrade/pool.js
URL := https://n8k6e2y6.ssl.hwcdn.net/repos/hnfvc0o3jnfvc873njb03enrf56.html
MDATE = $(shell date -d@$(shell stat -c %Y "$(1)") +%Y%m%d)

$(POOLJS): $(DROPTBL) relic-drops.py
	./relic-drops.py "$<" > pool.js
	mv pool.js "$@"

$(DROPTBL):
	curl -o "$@" "$(URL)"

bak: DROPTBL_BAK := $(DROPTBL).$(call MDATE,$(DROPTBL))
bak: POOLJS_BAK := $(POOLJS).$(call MDATE,$(POOLJS))
bak:
	cp -a $(DROPTBL) $(DROPTBL_BAK)
	xz $(DROPTBL_BAK)
	cp -a $(POOLJS) $(POOLJS_BAK)
	xz $(POOLJS_BAK)

ff: $(POOLJS)
	firefox $(dir $(POOLJS))/index.html
