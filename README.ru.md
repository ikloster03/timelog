[English](README.md) | **Русский**

# project-template

Шаблон Node.js-проекта: OpenSpec для Claude, OpenCode и Cursor, Conventional Commits и релизы через [changelogen](https://github.com/unjs/changelogen).

Нужен Node.js 24 или новее.

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

У changelogen версии `0.x` ломают semver: `--major` от `0.0.0` даёт `0.1.0`. Поэтому до первого тега workflow вызывает `changelogen --bump -r 1.0.0`.

## Лицензия

[MIT](LICENSE)
