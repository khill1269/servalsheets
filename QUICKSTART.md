# ServalSheets Quickstart

Get up and running with ServalSheets in Claude Desktop in **5 minutes**.

---

## Choose Your Setup Method

### 🌟 **OAuth (Recommended)** - Sign in with Google

**Best for**: Personal use, easiest setup

```bash
./setup-claude-oauth.sh
```

**What you'll need**:
- Google OAuth credentials (we'll guide you through getting these)

**What happens**:
1. Script asks for your OAuth Client ID and Secret
2. Builds the project and configures everything
3. Updates Claude Desktop config
4. First time you use it, click a link to authorize
5. Done! Works automatically after that

**Time**: 5 minutes including Google Cloud setup

[Full OAuth Guide →](./CLAUDE_DESKTOP_OAUTH_SETUP.md)

---

### 🔐 **Service Account** - Automated access

**Best for**: Production, sharing with team

```bash
./install-claude-desktop.sh
```

**What you'll need**:
- Service account JSON file from Google Cloud

**What happens**:
1. Download service account credentials
2. Script configures Claude Desktop
3. Share each spreadsheet with service account email
4. Works automatically

**Time**: 10 minutes

[Full Service Account Guide →](./CLAUDE_DESKTOP_SETUP.md)

---

## After Setup

### Restart Claude Desktop

**Important**: You must fully quit and reopen:

```bash
# Quit Claude Desktop completely
killall Claude

# Or press ⌘+Q in Claude Desktop

# Then reopen from Applications
open -a Claude
```

### First Use (OAuth Only)

In Claude Desktop, try:
```
"List all my Google Sheets"
```

Claude will show:
```
🔐 Authorization Required

Click here to authorize: http://localhost:3000/authorize?redirect_uri=http://localhost:3000/callback
```

**Click the link**, sign in with Google, and you're done!

### Test It

Try these in Claude Desktop:

```
"List all my Google Sheets"

"Read the first 10 rows from Sheet1 in [spreadsheet-url]"

"Create a new spreadsheet called 'Test Sheet'"

"Format cells A1:B10 with bold text and blue background"
```

---

## What Can You Do?

✅ Read and write data
✅ Create and delete sheets
✅ Format cells (colors, fonts, borders)
✅ Create charts and pivot tables
✅ Add comments
✅ Manage permissions
✅ Use semantic queries ("find the Revenue column")
✅ Safety features (dry-run mode, limits)

---

## Troubleshooting

### "Server not responding" (OAuth mode)

Check if the HTTP server is running:
```bash
curl http://localhost:3000/health
```

If not running, Claude Desktop should start it automatically. If it doesn't:
```bash
npm run start:http
```

### "Authorization link doesn't work"

Make sure you added `http://localhost:3000/callback` as a redirect URI in Google Cloud Console:

1. Go to https://console.cloud.google.com/apis/credentials
2. Click your OAuth client ID
3. Under "Authorized redirect URIs", add: `http://localhost:3000/callback`
4. Save

### "Invalid credentials" (Service account mode)

1. Check the path in Claude Desktop config is correct
2. Make sure the JSON file exists and is readable
3. Verify you've shared the spreadsheet with the service account email

### Still having issues?

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed help.

---

## Comparison

| Feature | OAuth | Service Account |
|---------|-------|-----------------|
| **Setup Time** | 5 min | 10 min |
| **User Experience** | Sign in with Google | Download JSON file |
| **Sheet Access** | Automatic | Must share each sheet |
| **Best For** | Personal use | Production |
| **Authentication** | Browser flow | JSON key |
| **Security** | User permissions | Service permissions |

---

## Next Steps

### Learn More

- [Full feature list](./README.md#features)
- [Examples](./examples/)
- [API documentation](./docs/api/)

### Deploy to Production

- [Production deployment guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Security best practices](./SECURITY.md)
- [Monitoring setup](./MONITORING.md)

---

**Questions?** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) or check the logs:
- Claude Desktop logs: `~/Library/Logs/Claude/`
- Server logs: Console where you ran `npm run start:http`

---

**Ready to start?**

```bash
./setup-claude-oauth.sh
```

**That's it! Enjoy ServalSheets! 🎉**
