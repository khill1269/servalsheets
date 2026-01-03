# Publishing ServalSheets to npm

**Complete guide for publishing ServalSheets to npm**

**Author**: Thomas Lee Cahill
**Repository**: https://github.com/khill1269/servalsheets
**Package**: `servalsheets`

---

## Prerequisites

### 1. npm Account

You need an npm account to publish. If you don't have one:

```bash
# Create account at https://www.npmjs.com/signup

# Or via CLI
npm adduser
```

### 2. npm Access Token (for CI/CD)

For GitHub Actions to publish automatically:

1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Click **Generate New Token** → **Classic Token**
3. Select **Automation** (for CI/CD) or **Publish** (for manual)
4. Copy the token (starts with `npm_`)
5. Add to GitHub Secrets:
   - Go to https://github.com/khill1269/servalsheets/settings/secrets/actions
   - Click **New repository secret**
   - Name: `NPM_TOKEN`
   - Value: Paste your token
   - Click **Add secret**

### 3. Package Name

**Current**: `servalsheets`

**Options**:
- **Keep `servalsheets`**: If you have permission from Anthropic
- **Change to `@khill1269/servalsheets`**: Your personal npm scope
- **Change to `servalsheets`**: No scope (if available)

**To change package name**, edit `package.json`:
```json
{
  "name": "@khill1269/servalsheets",
  ...
}
```

And `server.json`:
```json
{
  "packages": [{
    "identifier": "@khill1269/servalsheets",
    ...
  }]
}
```

---

## Pre-Publishing Checklist

Before publishing, verify everything is ready:

### 1. Build and Test

```bash
# Clean build
npm run clean
npm run build

# Type check
npm run typecheck

# Run tests
npm test -- --run

# All should pass with 0 errors
```

### 2. Verify Package Contents

```bash
# Dry run to see what will be published
npm pack --dry-run

# Should include:
# - dist/          (compiled code)
# - server.json    (MCP manifest)
# - *.md files     (documentation)
# - LICENSE

# Actual pack to inspect
npm pack
tar -tzf servalsheets-1.0.0.tgz
# Review the file list carefully
rm servalsheets-1.0.0.tgz
```

### 3. Test Package Locally

```bash
# Pack the package
npm pack

# Install locally in a test project
cd /tmp
mkdir test-servalsheets
cd test-servalsheets
npm init -y
npm install /path/to/servalsheets-1.0.0.tgz

# Test it works
npx servalsheets --help
# Should show help text

# Clean up
cd ..
rm -rf test-servalsheets
```

### 4. Version Check

```bash
# Current version in package.json
cat package.json | grep '"version"'
# Should be: "version": "1.0.0"

# Check if version already exists on npm
npm view servalsheets versions
# If 1.0.0 is already published, you need to bump the version
```

### 5. Git Status

```bash
# Ensure all changes are committed
git status
# Should show: nothing to commit, working tree clean

# If you have uncommitted changes, commit them:
git add .
git commit -m "chore: prepare for npm publish v1.0.0"
git push origin main
```

---

## Publishing Methods

### Method 1: Manual Publishing (Recommended First Time)

**Use this for your first publish to verify everything works.**

```bash
# 1. Login to npm
npm login
# Enter username, password, email, and 2FA code

# 2. Verify you're logged in
npm whoami
# Should show your npm username

# 3. Publish (dry run first)
npm publish --dry-run --provenance
# Review the output carefully

# 4. Publish for real
npm publish --provenance --access public
# For scoped packages (@anthropic/...), use --access public
# For unscoped packages, omit --access public

# 5. Verify publication
npm view servalsheets
# Should show your package info
```

**Expected output**:
```
+ servalsheets@1.0.0
```

### Method 2: Automated Publishing via GitHub Actions

**Use this for subsequent releases after the first manual publish.**

This is already set up in `.github/workflows/publish.yml`.

#### Option A: Publish on GitHub Release (Recommended)

```bash
# 1. Bump version
npm version patch  # 1.0.0 → 4.0.1
# OR
npm version minor  # 1.0.0 → 4.1.0
# OR
npm version major  # 1.0.0 → 5.0.0

# This automatically:
# - Updates package.json version
# - Creates a git commit
# - Creates a git tag

# 2. Push with tags
git push origin main --tags

# 3. Create GitHub Release
# Go to: https://github.com/khill1269/servalsheets/releases/new
# - Tag: Select the tag you just pushed (v4.0.1)
# - Title: v4.0.1
# - Description: Release notes (see CHANGELOG.md)
# - Click "Publish release"

# 4. GitHub Action will automatically:
# - Run tests
# - Build the package
# - Publish to npm with provenance
```

#### Option B: Manual Trigger

```bash
# Trigger the workflow manually from GitHub:
# 1. Go to: https://github.com/khill1269/servalsheets/actions/workflows/publish.yml
# 2. Click "Run workflow"
# 3. Select branch: main
# 4. Enter "false" for dry-run (or "true" to test)
# 5. Click "Run workflow"
```

---

## After Publishing

### 1. Verify Package

```bash
# Check npm
npm view servalsheets

# Install and test
npm install -g servalsheets
servalsheets --help

# Uninstall after testing
npm uninstall -g servalsheets
```

### 2. Update Documentation

If this is your first publish, update:

- `README.md` - Verify installation instructions work
- `USAGE_GUIDE.md` - Verify all examples work
- `CLAUDE_DESKTOP_SETUP.md` - Verify setup instructions work

### 3. Announce

- Tweet/post about the release
- Share in relevant communities (MCP Discord, etc.)
- Update your GitHub README with npm badge

---

## Troubleshooting

### Error: "You do not have permission to publish"

**Cause**: You don't have access to the `@anthropic` scope

**Solution**:
- Contact Anthropic for permission
- OR change package name to `@khill1269/servalsheets`
- OR use unscoped name `servalsheets` (if available)

### Error: "Version 1.0.0 already published"

**Cause**: Version already exists on npm

**Solution**: Bump the version
```bash
npm version patch  # Bumps to 4.0.1
git push origin main --tags
npm publish --provenance --access public
```

### Error: "ENEEDAUTH"

**Cause**: Not logged in to npm

**Solution**:
```bash
npm login
# Then try publishing again
```

### Error: "Package size exceeds maximum"

**Cause**: Package is too large (> 10MB)

**Solution**: Check `.npmignore` is properly configured
```bash
npm pack --dry-run
# Review what's being included
# Add unnecessary files to .npmignore
```

### Error: "Provenance failed"

**Cause**: Publishing without proper authentication in GitHub Actions

**Solution**: Ensure GitHub Actions has `id-token: write` permission (already configured in `.github/workflows/publish.yml`)

---

## Version Strategy

### Semantic Versioning

Use semantic versioning (semver):
- **MAJOR** (5.0.0): Breaking changes
- **MINOR** (4.1.0): New features, backwards compatible
- **PATCH** (4.0.1): Bug fixes, backwards compatible

### When to Bump

- **Patch** (4.0.x): Bug fixes, documentation updates, performance improvements
- **Minor** (4.x.0): New tools, new actions, new features (backwards compatible)
- **Major** (x.0.0): Breaking API changes, removing tools, changing behavior

### Bumping Version

```bash
# Patch release (1.0.0 → 4.0.1)
npm version patch -m "fix: resolve authentication issue"

# Minor release (1.0.0 → 4.1.0)
npm version minor -m "feat: add new spreadsheet_batch tool"

# Major release (1.0.0 → 5.0.0)
npm version major -m "BREAKING: change intent structure"

# This automatically:
# - Updates package.json and server.json
# - Creates git commit
# - Creates git tag

# Push
git push origin main --tags
```

---

## Pricing and Licensing

### Current License: MIT

**MIT License** means:
- Anyone can use your code **for free**
- Anyone can modify and redistribute
- Anyone can use it commercially
- You provide **no warranty**

### If You Want to Make Money

**Options**:

#### Option 1: Dual License
- Keep MIT for open source
- Offer commercial license for enterprises
- Example: "Free for personal use, paid for companies > 50 employees"

#### Option 2: Open Core
- Keep core MIT
- Sell premium features separately
  - Advanced tools
  - Enterprise support
  - SLA guarantees
  - Multi-tenant features

#### Option 3: Freemium
- Free tier: Basic features
- Paid tier: Advanced features via separate npm package
- Example: `@khill1269/servalsheets-pro`

#### Option 4: Support & Services
- Keep MIT
- Charge for:
  - Priority support
  - Custom integrations
  - Consulting
  - Training
  - Managed hosting

### Recommended Monetization Strategy

For ServalSheets, I recommend **Option 4 (Support & Services)**:

1. **Keep MIT License** - Maximum adoption
2. **Free community support** - GitHub issues
3. **Paid tier options**:
   - Priority email support: $99/month
   - Custom integration: $2,000 one-time
   - Enterprise SLA: $499/month
   - Managed hosting: $299/month

4. **Add to README.md**:
```markdown
## Support

- **Community Support**: Free via [GitHub Issues](https://github.com/khill1269/servalsheets/issues)
- **Priority Support**: [Contact for pricing](mailto:your@email.com)
- **Enterprise Support**: Custom SLA, training, and consulting available

For commercial support inquiries, contact: your@email.com
```

---

## npm Package Name

**IMPORTANT**: Decide on your npm package name before first publish!

### Current: `servalsheets`

**Pros**:
- Recognizable brand
- Anthropic association

**Cons**:
- Need permission from Anthropic
- Not clearly "yours"

**Action needed**: Contact Anthropic for permission or change name

### Option: `@khill1269/servalsheets`

**Pros**:
- Your personal scope
- No permission needed
- Clear ownership

**Cons**:
- Less discoverable
- Need to create npm organization

**To use**:
```bash
# Update package.json
{
  "name": "@khill1269/servalsheets"
}

# Update server.json
{
  "packages": [{
    "identifier": "@khill1269/servalsheets"
  }]
}
```

### Option: `servalsheets` (unscoped)

**Pros**:
- Short and clean
- Maximum discoverability

**Cons**:
- Might be taken
- No namespace protection

**Check availability**:
```bash
npm view servalsheets
# If error "404 Not Found" - it's available!
```

---

## Summary

### Quick Publish Checklist

- [ ] All tests passing (`npm test -- --run`)
- [ ] Build succeeds (`npm run build`)
- [ ] Package name decided (`servalsheets` or change it)
- [ ] npm account created and logged in
- [ ] Package contents verified (`npm pack --dry-run`)
- [ ] Version correct (check `package.json`)
- [ ] All changes committed to git
- [ ] GitHub secrets configured (`NPM_TOKEN`)

### Commands to Publish

```bash
# One-time setup
npm login

# Before each publish
npm run clean
npm run build
npm test -- --run
npm pack --dry-run

# Publish
npm publish --provenance --access public

# Verify
npm view servalsheets
```

### After First Publish

- [ ] Test installation: `npm install -g servalsheets`
- [ ] Test CLI: `servalsheets --help`
- [ ] Verify npm page: https://www.npmjs.com/package/servalsheets
- [ ] Update badges in README if needed
- [ ] Announce the release

---

## Need Help?

- **npm documentation**: https://docs.npmjs.com/
- **Semantic versioning**: https://semver.org/
- **npm pricing/scopes**: https://www.npmjs.com/products
- **MIT License**: https://opensource.org/licenses/MIT

---

**Ready to publish?** Start with Manual Publishing (Method 1) for your first time!

Good luck! 🚀
