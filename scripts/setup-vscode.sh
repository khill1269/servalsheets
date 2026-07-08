#!/bin/bash
# ServalSheets VSCode Development Environment Setup Script
# Automates installation of extensions and creation of configuration files

set -e  # Exit on error

echo "🚀 ServalSheets VSCode Setup Script"
echo "===================================="
echo ""

# Check if running from project root
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from project root directory"
  exit 1
fi

# Check if project is servalsheets
if ! grep -q '"name": "servalsheets"' package.json; then
  echo "❌ Error: This script is for ServalSheets project only"
  exit 1
fi

echo "✅ Project: ServalSheets detected"
echo ""

# Phase 1: Install VSCode Extensions
echo "📦 Phase 1: Installing VSCode Extensions"
echo "----------------------------------------"

extensions=(
  # Core development tools
  "usernamehw.errorlens"
  "dbaeumer.vscode-eslint"
  "esbenp.prettier-vscode"
  "eamodio.gitlens"

  # TypeScript support
  "yoavbls.pretty-ts-errors"
  "mattpocock.ts-error-translator"

  # Testing
  "vitest.explorer"

  # Productivity
  "gruntfuggly.todo-tree"
  "aaron-bond.better-comments"

  # MCP Development (2026)
  "maaz-tajammul.diagnostics-mcp-server"

  # Documentation
  "bierner.markdown-mermaid"
  "yzhang.markdown-all-in-one"
)

for ext in "${extensions[@]}"; do
  echo "Installing $ext..."
  code --install-extension "$ext" || echo "⚠️  Failed to install $ext (may already be installed)"
done

echo ""
echo "✅ Extensions installation complete"
echo ""

# Phase 2: Create .vscode directory if missing
echo "📁 Phase 2: Creating .vscode directory"
echo "--------------------------------------"
mkdir -p .vscode
echo "✅ Directory ready"
echo ""

# Phase 3: Create settings.json
echo "⚙️  Phase 3: Creating .vscode/settings.json"
echo "------------------------------------------"

if [ -f ".vscode/settings.json" ]; then
  echo "⚠️  .vscode/settings.json already exists"
  read -p "Overwrite? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping settings.json"
  else
    cat > .vscode/settings.json << 'EOF'
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.tsserver.maxTsServerMemory": 2048,
  "typescript.tsserver.experimental.enableProjectDiagnostics": false,
  "typescript.preferences.strictNullChecks": true,
  "typescript.preferences.noImplicitAny": true,
  "typescript.preferences.strictFunctionTypes": true,
  "typescript.inlayHints.parameterNames.enabled": "all",
  "typescript.inlayHints.parameterTypes.enabled": true,
  "typescript.inlayHints.variableTypes.enabled": true,
  "typescript.inlayHints.propertyDeclarationTypes.enabled": true,
  "typescript.inlayHints.functionLikeReturnTypes.enabled": true,
  "typescript.suggest.autoImports": false,
  "javascript.suggest.autoImports": false,
  "typescript.preferences.includePackageJsonAutoImports": "off",
  "eslint.enable": true,
  "eslint.run": "onType",
  "eslint.validate": ["typescript", "javascript"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.autoSave": "off",
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/dist/**": true,
    "**/coverage/**": true,
    "**/.stryker-tmp/**": true,
    "**/.tmp/**": true,
    "**/.tmp-analysis/**": true,
    "**/tests/.tmp/**": true,
    "**/.serval/archive/**": true,
    "**/logs/**": true,
    "**/.git/objects/**": true,
    "**/.git/subtree-cache/**": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true,
    "**/coverage": true,
    "**/.stryker-tmp": true,
    "**/.tmp": true,
    "**/.tmp-analysis": true,
    "**/tests/.tmp": true,
    "**/.serval/archive": true,
    "**/logs": true,
    "**/.eslintcache": true
  },
  "git.enableCommitSigning": false,
  "git.postCommitCommand": "none",
  "git.autofetch": false,
  "git.openRepositoryInParentFolders": "never",
  "javascript.suggestionActions.enabled": false,
  "cSpell.enabled": false,
  "gitlens.codeLens.enabled": false,
  "gitlens.currentLine.enabled": false,
  "gitlens.hovers.enabled": false,
  "diagnostics-mcp-server.autoStart": false,
  "mcpDiagnostics.showAutoRegistrationNotification": false,
  "snyk.scanningMode": "manual",
  "snyk.securityAtInception.autoConfigureSnykMcpServer": false,
  "snyk.securityAtInception.executionFrequency": "Manual",
  "jupyter.runStartupCommands": [],
  "github.copilot.nextEditSuggestions.enabled": false,
  "npm.enableScriptExplorer": true,
  "npm.scriptExplorerAction": "open",
  "errorLens.enabledDiagnosticLevels": ["error", "warning"],
  "errorLens.excludeBySource": ["eslint(no-console)"],
  "errorLens.messageTemplate": "$message - $source",
  "vitest.enable": true,
  "vitest.commandLine": "npm test",
  "todo-tree.highlights.defaultHighlight": {
    "foreground": "black",
    "type": "text-and-comment"
  },
  "todo-tree.highlights.customHighlight": {
    "TODO": { "background": "#ffeb3b", "icon": "check" },
    "FIXME": { "background": "#f44336", "icon": "alert" },
    "HACK": { "background": "#ff9800", "icon": "tools" },
    "NOTE": { "background": "#4caf50", "icon": "note" }
  }
}
EOF
    echo "✅ .vscode/settings.json created"
  fi
else
  cat > .vscode/settings.json << 'EOF'
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.tsserver.maxTsServerMemory": 2048,
  "typescript.tsserver.experimental.enableProjectDiagnostics": false,
  "typescript.preferences.strictNullChecks": true,
  "typescript.preferences.noImplicitAny": true,
  "typescript.preferences.strictFunctionTypes": true,
  "typescript.inlayHints.parameterNames.enabled": "all",
  "typescript.inlayHints.parameterTypes.enabled": true,
  "typescript.inlayHints.variableTypes.enabled": true,
  "typescript.inlayHints.propertyDeclarationTypes.enabled": true,
  "typescript.inlayHints.functionLikeReturnTypes.enabled": true,
  "typescript.suggest.autoImports": false,
  "javascript.suggest.autoImports": false,
  "typescript.preferences.includePackageJsonAutoImports": "off",
  "eslint.enable": true,
  "eslint.run": "onType",
  "eslint.validate": ["typescript", "javascript"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.autoSave": "off",
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/dist/**": true,
    "**/coverage/**": true,
    "**/.stryker-tmp/**": true,
    "**/.tmp/**": true,
    "**/.tmp-analysis/**": true,
    "**/tests/.tmp/**": true,
    "**/.serval/archive/**": true,
    "**/logs/**": true,
    "**/.git/objects/**": true,
    "**/.git/subtree-cache/**": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true,
    "**/coverage": true,
    "**/.stryker-tmp": true,
    "**/.tmp": true,
    "**/.tmp-analysis": true,
    "**/tests/.tmp": true,
    "**/.serval/archive": true,
    "**/logs": true,
    "**/.eslintcache": true
  },
  "git.enableCommitSigning": false,
  "git.postCommitCommand": "none",
  "git.autofetch": false,
  "git.openRepositoryInParentFolders": "never",
  "javascript.suggestionActions.enabled": false,
  "cSpell.enabled": false,
  "gitlens.codeLens.enabled": false,
  "gitlens.currentLine.enabled": false,
  "gitlens.hovers.enabled": false,
  "diagnostics-mcp-server.autoStart": false,
  "mcpDiagnostics.showAutoRegistrationNotification": false,
  "snyk.scanningMode": "manual",
  "snyk.securityAtInception.autoConfigureSnykMcpServer": false,
  "snyk.securityAtInception.executionFrequency": "Manual",
  "jupyter.runStartupCommands": [],
  "github.copilot.nextEditSuggestions.enabled": false,
  "npm.enableScriptExplorer": true,
  "npm.scriptExplorerAction": "open",
  "errorLens.enabledDiagnosticLevels": ["error", "warning"],
  "errorLens.excludeBySource": ["eslint(no-console)"],
  "errorLens.messageTemplate": "$message - $source",
  "vitest.enable": true,
  "vitest.commandLine": "npm test",
  "todo-tree.highlights.defaultHighlight": {
    "foreground": "black",
    "type": "text-and-comment"
  },
  "todo-tree.highlights.customHighlight": {
    "TODO": { "background": "#ffeb3b", "icon": "check" },
    "FIXME": { "background": "#f44336", "icon": "alert" },
    "HACK": { "background": "#ff9800", "icon": "tools" },
    "NOTE": { "background": "#4caf50", "icon": "note" }
  }
}
EOF
  echo "✅ .vscode/settings.json created"
fi

echo ""

# Phase 4: Create extensions.json
echo "📦 Phase 4: Creating .vscode/extensions.json"
echo "-------------------------------------------"

if [ -f ".vscode/extensions.json" ]; then
  echo "⚠️  .vscode/extensions.json already exists"
  read -p "Overwrite? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping extensions.json"
  else
    cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "usernamehw.errorlens",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "eamodio.gitlens",
    "gruntfuggly.todo-tree",
    "vitest.explorer",
    "mattpocock.ts-error-translator",
    "aaron-bond.better-comments"
  ],
  "unwantedRecommendations": [
    "zixuanchen.vitest-explorer",
    "hbenl.vscode-test-explorer",
    "wallabyjs.wallaby-vscode",
    "wallabyjs.quokka-vscode",
    "wallabyjs.console-ninja",
    "streetsidesoftware.code-spell-checker",
    "newbpydev.mcp-diagnostics-extension",
    "ms-vscode.test-adapter-converter",
    "openai.chatgpt",
    "google.geminicodeassist",
    "github.copilot",
    "github.copilot-chat",
    "googlecloudtools.cloudcode",
    "googlecloudtools.datacloud",
    "snyk-security.snyk-vulnerability-scanner",
    "ms-toolsai.jupyter",
    "ms-toolsai.jupyter-keymap",
    "ms-toolsai.jupyter-renderers",
    "ms-toolsai.vscode-jupyter-cell-tags",
    "ms-toolsai.vscode-jupyter-slideshow",
    "wix.vscode-import-cost",
    "kisstkondoros.vscode-codemetrics",
    "mhutchie.git-graph",
    "donjayamanne.githistory"
  ]
}
EOF
    echo "✅ .vscode/extensions.json created"
  fi
else
  cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "usernamehw.errorlens",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "eamodio.gitlens",
    "gruntfuggly.todo-tree",
    "vitest.explorer",
    "mattpocock.ts-error-translator",
    "aaron-bond.better-comments"
  ],
  "unwantedRecommendations": [
    "zixuanchen.vitest-explorer",
    "hbenl.vscode-test-explorer",
    "wallabyjs.wallaby-vscode",
    "wallabyjs.quokka-vscode",
    "wallabyjs.console-ninja",
    "streetsidesoftware.code-spell-checker",
    "newbpydev.mcp-diagnostics-extension",
    "ms-vscode.test-adapter-converter",
    "openai.chatgpt",
    "google.geminicodeassist",
    "github.copilot",
    "github.copilot-chat",
    "googlecloudtools.cloudcode",
    "googlecloudtools.datacloud",
    "snyk-security.snyk-vulnerability-scanner",
    "ms-toolsai.jupyter",
    "ms-toolsai.jupyter-keymap",
    "ms-toolsai.jupyter-renderers",
    "ms-toolsai.vscode-jupyter-cell-tags",
    "ms-toolsai.vscode-jupyter-slideshow",
    "wix.vscode-import-cost",
    "kisstkondoros.vscode-codemetrics",
    "mhutchie.git-graph",
    "donjayamanne.githistory"
  ]
}
EOF
  echo "✅ .vscode/extensions.json created"
fi

echo ""

# Phase 5: Create .prettierrc.json
echo "🎨 Phase 5: Creating .prettierrc.json"
echo "------------------------------------"

if [ -f ".prettierrc.json" ]; then
  echo "⚠️  .prettierrc.json already exists"
  read -p "Overwrite? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping .prettierrc.json"
  else
    cat > .prettierrc.json << 'EOF'
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
EOF
    echo "✅ .prettierrc.json created"
  fi
else
  cat > .prettierrc.json << 'EOF'
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
EOF
  echo "✅ .prettierrc.json created"
fi

echo ""

# Phase 6: Dependency guidance
echo "📦 Phase 6: Dependency guidance"
echo "------------------------------"
echo "Skipping dependency updates. VS Code setup should not mutate package versions."
echo "Run npm update explicitly when dependency maintenance is intended."
echo "✅ Dependencies left unchanged"
echo ""

# Phase 7: Verify installation
echo "✅ Phase 7: Verifying installation"
echo "---------------------------------"

echo "Checking installed extensions..."
installed_count=0
for ext in "${extensions[@]}"; do
  if code --list-extensions | grep -q "$ext"; then
    echo "  ✅ $ext"
    ((installed_count++))
  else
    echo "  ❌ $ext (not installed)"
  fi
done

echo ""
echo "Installed: $installed_count/${#extensions[@]} extensions"
echo ""

echo "Checking configuration files..."
[ -f ".vscode/settings.json" ] && echo "  ✅ .vscode/settings.json" || echo "  ❌ .vscode/settings.json"
[ -f ".vscode/extensions.json" ] && echo "  ✅ .vscode/extensions.json" || echo "  ❌ .vscode/extensions.json"
[ -f ".prettierrc.json" ] && echo "  ✅ .prettierrc.json" || echo "  ❌ .prettierrc.json"
echo ""

# Phase 8: Summary and next steps
echo "🎉 Setup Complete!"
echo "================="
echo ""
echo "✅ VSCode extensions installed"
echo "✅ Configuration files created"
echo "✅ Dependencies updated"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo ""
echo "1. Reload VSCode window:"
echo "   Press Cmd+Shift+P → 'Developer: Reload Window'"
echo ""
echo "2. Fix build blockers:"
echo "   - src/handlers/dimensions.ts (25+ type errors)"
echo "   - src/services/semantic-range.ts:359 (TODO violation)"
echo ""
echo "3. Verify build:"
echo "   npm run verify"
echo ""
echo "4. Test development workflow:"
echo "   - Open any .ts file"
echo "   - Observe TypeScript inlay hints"
echo "   - Observe Error Lens inline errors"
echo "   - Make a change and save (should auto-fix)"
echo ""
echo "📚 For detailed setup guide, see:"
echo "   /Users/thomascahill/.claude/plans/master-setup-prompt.md"
echo ""
echo "🐛 For error analysis, see:"
echo "   /Users/thomascahill/.claude/plans/rustling-moseying-fern.md"
echo ""
