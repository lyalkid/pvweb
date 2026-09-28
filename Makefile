# Phylo Viewer Web — статическое приложение для GitHub Pages.
#
# BASE задаёт базовый путь сборки. На Pages сайт живёт в подкаталоге /<репозиторий>/,
# локально достаточно корня. Workflow передаёт BASE из имени репозитория.

BASE ?= /
NPM ?= npm

.DEFAULT_GOAL := help

.PHONY: help install install-ci dev build preview check check-types check-lint test ci clean distclean

help:
	@echo "Доступные цели:"
	@echo "  make install      - установить зависимости"
	@echo "  make dev          - запустить приложение в режиме разработки"
	@echo "  make build        - собрать в dist/ (BASE=/pvweb/ для GitHub Pages)"
	@echo "  make preview      - посмотреть собранную версию"
	@echo "  make check        - проверить типы и прогнать линтер"
	@echo "  make check-types  - только проверка типов"
	@echo "  make check-lint   - только линтер"
	@echo "  make test         - прогнать тесты"
	@echo "  make ci           - проверки, тесты и сборка (используется в workflow)"
	@echo "  make clean        - удалить dist/"
	@echo "  make distclean    - удалить dist/ и node_modules/"

install:
	$(NPM) install

# npm ci требует package-lock.json и ставит ровно зафиксированные версии.
install-ci:
	$(NPM) ci

dev:
	$(NPM) run dev

build:
	$(NPM) run build -- --base=$(BASE)

preview:
	$(NPM) run preview

check: check-types check-lint

check-types:
	$(NPM) run check:types

check-lint:
	$(NPM) run check:lint

test:
	$(NPM) test

ci: check test build

clean:
	rm -rf dist

distclean: clean
	rm -rf node_modules
