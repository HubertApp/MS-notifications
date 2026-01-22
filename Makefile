NPM = npm
# SCANNER = sonar-scanner

.PHONY: install lint test sonar all

install:
    $(NPM) ci

lint:
    $(NPM) run lint

test:
    $(NPM) test -- --coverage

# sonar:
#     $(SCANNER) \
#       -Dsonar.projectKey=ton-projet \
#       -Dsonar.sources=src \
#       -Dsonar.host.url=https://sonarcloud.io

validate: install lint test