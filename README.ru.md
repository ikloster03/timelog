[English](README.md) | **Русский**

# timelog

Сервис учёта времени. Одно развёртывание — один общий журнал в PostgreSQL. Клиенты ходят в него по HTTP и MCP с bearer-токеном. Своего интерфейса у журнала нет. Описание продукта — в [draft.md](draft.md).

Каркас из [project-template](https://github.com/ikloster03/project-template): OpenSpec для Claude, OpenCode и Cursor, Conventional Commits и релизы через [changelogen](https://github.com/unjs/changelogen).

Нужен Node.js 24 или новее.

## Запуск

Процесс читает `DATABASE_URL` и слушает `PORT` (по умолчанию `3000`). Миграции Drizzle применяются до открытия порта. Если миграция не прошла, процесс завершается и порт не открывает. Роли в URL нужны права менять схему.

Токен создаётся внутри контейнера приложения. Секрет печатается один раз. Его передают как `Authorization: Bearer <secret>`.

```sh
node dist/cli.js token list
node dist/cli.js token create
node dist/cli.js token revoke <id>
```

Справочник — `/scalar`. Живость — `GET /health`. Журнал — `/logs`. MCP — Streamable HTTP на `/mcp`.

### Postgres рядом

```sh
docker compose up --build
docker compose exec app node dist/cli.js token create
```

Compose поднимает Postgres с томом и приложение с `DATABASE_URL` на эту базу. Пароль в файле Compose — только для этой локальной базы.

### Внешняя база

`docker-compose.external.yml` поднимает только приложение. Уже доступный адрес передаётся в `DATABASE_URL`. База на той же машине доступна как `host.docker.internal`, не как `localhost`.

```sh
DATABASE_URL='postgres://user:pass@host:5432/timelog' docker compose -f docker-compose.external.yml up --build
docker compose -f docker-compose.external.yml exec app node dist/cli.js token create
```

## Что внутри

- `commitlint` и нативный хук `.githooks/commit-msg`. Скрипт `prepare` ставит хук при `npm install`.
- Хук снимает трейлер `Co-authored-by` и проверяет сообщение коммита.
- Релиз вручную: Actions → **Release**. Первый релиз всегда `1.0.0`. Дальше выбор `patch`, `minor` или `major`.
- OpenSpec: команды и скиллы для Cursor, Claude и OpenCode.

## Новый репозиторий

На странице шаблона нажмите **Use this template** и создайте репозиторий. GitHub копирует файлы как есть и не подставляет имя проекта.

После генерации:

1. В `package.json` замените `name` и `repository.url` на новый репозиторий.
2. В `LICENSE` замените строку copyright, если проект ведёт другой автор.
3. В `openspec/config.yaml` допишите стек и договорённости нового проекта.
4. Поставьте зависимости: `npm install`. Скрипт `prepare` скопирует хук в `.git/hooks/commit-msg`.
5. Первый релиз: на ветке `main` откройте Actions → **Release** → **Run workflow**. Пока нет git-тегов, версия станет `1.0.0` при любом выборе bump.

## Коммиты

Сообщение в формате Conventional Commits: `type: subject`. Тема в нижнем регистре, без точки в конце.

Типы: `feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`, `perf`, `build`, `style`, `revert`.

Трейлер `Co-authored-by` в сообщение не добавляйте. Хук его вырезает, проверка commitlint идёт уже без него.

Проверка без коммита:

```sh
echo "foo: this will fail" | npx commitlint
echo "chore: add commitlint and native git hooks" | npx commitlint
```

## Релизы

Workflow запускается только с `main`. Он ставит зависимости, обновляет `package.json` и `CHANGELOG.md`, коммитит `chore(release): vX.Y.Z`, ставит тег `vX.Y.Z` и создаёт GitHub Release.

Локально смотреть черновик журнала: `npm run changelog`. Версию и тег выпускает CI, локальный `changelogen --release` версию не публикует.

У changelogen версии `0.x` ломают semver: `--major` от `0.0.0` даёт `0.1.0`. Поэтому до первого тега workflow вызывает `changelogen --bump -r 1.0.0`. Если в `package.json` уже стоит `1.0.0`, changelogen завершается с ошибкой: версия не меняется. Workflow сначала ставит `0.0.0` и заменяет `CHANGELOG.md`, затем вызывает эту команду. Строка `fatal: No names found` от `git describe` без тегов шаг не роняет.

## Лицензия

[MIT](LICENSE)
