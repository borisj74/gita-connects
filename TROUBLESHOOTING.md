# Troubleshooting Gita Connects

## Common Issues

### Blank Screen

If you see a blank screen:

1. **Check Browser Console** (F12 or Cmd+Option+I)
   - Look for any red error messages
   - Common errors might be import issues or missing dependencies

2. **Hard Refresh**
   - Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Firefox: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

3. **Clear Browser Cache**
   - Go to Developer Tools > Application > Clear Storage
   - Or try opening in Incognito/Private mode

4. **Restart Dev Server**
   ```bash
   # Stop the server (Ctrl+C in the terminal)
   # Then restart:
   npm run dev
   ```

### Import Errors

If you see "Importing binding name 'X' is not found":
- Make sure all imports in TypeScript files use `.js` extensions
- Check that types are imported with `import type { ... }`

### Dependencies Not Found

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## What You Should See

When the app loads correctly:

- **Left Sidebar**: Chapters 1-18 with collapsible verse lists
- **Center**: Network visualization with 5 initial verse nodes connected
- **Right Panel**: Empty state with "No Verse Selected" message
- **Top**: "Gita Connects" header with search bar

## Browser Console Commands

Open console and try:
```javascript
// Check if React is loaded
console.log(window.React)

// Check if root element exists
console.log(document.getElementById('root'))

// Check if any CSS is loaded
console.log(document.styleSheets.length)
```
