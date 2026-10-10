**English** | [Русский](README.ru.md)

# project-template

A Node.js project template: OpenSpec for Claude, OpenCode, and Cursor, Conventional Commits, and releases via [changelogen](https://github.com/unjs/changelogen).

Requires Node.js 24 or newer.

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
