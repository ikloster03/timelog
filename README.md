**English** | [Русский](README.ru.md)

# timelog

Time logging service. One deployment is one shared journal in PostgreSQL. Clients reach it over HTTP and MCP with a bearer token. There is no journal UI. The product outline is in [draft.md](draft.md).

Scaffold from [project-template](https://github.com/ikloster03/project-template): OpenSpec for Claude, OpenCode, and Cursor, Conventional Commits, and releases via [changelogen](https://github.com/unjs/changelogen).

Requires Node.js 24 or newer.

## Run

The process reads `DATABASE_URL` and listens on `PORT` (default `3000`). It applies Drizzle migrations before it opens the port. If a migration fails, the process exits and does not listen. The database role needs permission to change the schema.

Create a token inside the app container. The secret is printed once. Send it as `Authorization: Bearer <secret>`.

```sh
node dist/cli.js token list
node dist/cli.js token create
node dist/cli.js token revoke <id>
```

The API reference is at `/scalar`. Liveness is `GET /health`. Journal routes are under `/logs`. MCP is Streamable HTTP at `/mcp`.

### Postgres alongside

```sh
docker compose up --build
docker compose exec app node dist/cli.js token create
```

Compose starts Postgres with a volume and the app with `DATABASE_URL` pointing at that database. The password in the Compose file is only for this local database.

### External database

`docker-compose.external.yml` starts only the app. Pass the existing URL in `DATABASE_URL`. A database on the same machine is reached as `host.docker.internal`, not `localhost`.

```sh
DATABASE_URL='postgres://user:pass@host:5432/timelog' docker compose -f docker-compose.external.yml up --build
docker compose -f docker-compose.external.yml exec app node dist/cli.js token create
```

## What is included

- `commitlint` and a native `.githooks/commit-msg` hook. `prepare` installs the hook on `npm install`.
- The hook strips a `Co-authored-by` trailer and checks the commit message.
- Releases are manual: Actions → **Release**. The first release is always `1.0.0`. Later runs take `patch`, `minor`, or `major`.
- OpenSpec commands and skills for Cursor, Claude, and OpenCode.

## New repository

On the template page, click **Use this template** and create a repository. GitHub copies the files as they are and does not fill in the project name.

After generation:

1. In `package.json`, set `name` and `repository.url` to the new repository.
2. In `LICENSE`, replace the copyright line when another author owns the project.
3. In `openspec/config.yaml`, add the new project's stack and conventions.
4. Install dependencies with `npm install`. `prepare` copies the hook to `.git/hooks/commit-msg`.
5. Cut the first release from `main`: Actions → **Release** → **Run workflow**. With no git tags yet, the version becomes `1.0.0` for any bump choice.

## Commits

Messages follow Conventional Commits: `type: subject`. The subject is lowercase and has no trailing period.

Types: `feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`, `perf`, `build`, `style`, `revert`.

Leave `Co-authored-by` out of the message. The hook removes that trailer, and commitlint checks the message after that.

Check a message without committing:

```sh
echo "foo: this will fail" | npx commitlint
echo "chore: add commitlint and native git hooks" | npx commitlint
```

## Releases

The workflow runs from `main` only. It installs dependencies, updates `package.json` and `CHANGELOG.md`, commits `chore(release): vX.Y.Z`, tags `vX.Y.Z`, and creates a GitHub Release.

Preview the changelog locally with `npm run changelog`. CI publishes the version and the tag. A local `changelogen --release` does not.

changelogen remaps semver on `0.x`: `--major` from `0.0.0` becomes `0.1.0`. Until the first tag exists, the workflow runs `changelogen --bump -r 1.0.0`.

## License

[MIT](LICENSE)
