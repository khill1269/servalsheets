# Changesets

Welcome to `changesets`! This folder stores **changeset** documents.

Changesets are not, by themselves, published to npm. Instead, they are consumed by the `changesets` CLI, which reads all the `.md` files (except `README.md`), and publishes new versions of packages when appropriate.

## What is a changeset?

A changeset is a piece of information about changes made in a pull request. It holds three bits of information:

- What we're changing
- What semver bump type it is (major, minor, patch)
- A summary of the changes

## Why is this information useful?

When we publish a new version of our packages to npm, we need to know what semver bump to do. We could calculate this on the repo, but that's complex, and to be honest, wrong most of the time, because we don't know what downstream consumers are doing.

Instead, the best way to decide what a semver bump should be is to ask the people making the changes. This is exactly what changesets does.

## How do I make one?

You can use the `changeset` command to create one of these files, which will walk you through the process of creating a summary of your changes.

```bash
npx changeset add
```

Otherwise, you can write a markdown file in this directory with the following format:

```markdown
---
pkgs:
  - servalsheets
  - @serval/core
bumps:
  - major
  - minor
---

Removing a lot of private APIs.
Adding new feature X.
```

## Tips

- **Every pull request should have a changeset.** (Unless it's a docs or internal tooling change)
- **Don't commit a changeset if you don't want it to be published** — for example, if you want to land a feature but not bump a package version in this release, you should not commit a changeset (though if you do, just remove it before merge)
- **The first time you publish**, you'll want to make sure to do a `changeset publish`
