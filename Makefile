NPM = npm
# SCANNER = sonar-scanner

.PHONY: install lint test test-integration test-perf validate

install:
	$(NPM) ci

lint:
	$(NPM) run lint

test:
	$(NPM) test -- --coverage

# Les suites d'integration et de performance ne sont PAS ramassees par `npm
# test` : jest.rootDir vaut "src" dans package.json, et ces suites vivent sous
# test/ avec leur propre configuration. Sans ces deux cibles, elles ne
# tournaient jamais en CI.
#   - integration : Mongo en memoire (mongodb-memory-server), aucune infra requise
#   - perf        : toutes les E/S simulees, donc deterministe et executable en CI
test-integration:
	$(NPM) run test:integration

test-perf:
	$(NPM) run test:perf

# sonar:
#	$(SCANNER) \
#	  -Dsonar.projectKey=ton-projet \
#	  -Dsonar.sources=src \
#	  -Dsonar.host.url=https://sonarcloud.io

validate: install lint test test-integration test-perf
