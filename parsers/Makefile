DROPTBL := droptables.html
POOLJS := ../wftrade/pool.js
URL := https://n8k6e2y6.ssl.hwcdn.net/repos/hnfvc0o3jnfvc873njb03enrf56.html

$(POOLJS): $(DROPTBL) relic-drops.py
	./relic-drops.py "$<" > pool.js
	mv pool.js "$@"

$(DROPTBL):
	curl -o "$@" "$(URL)"
