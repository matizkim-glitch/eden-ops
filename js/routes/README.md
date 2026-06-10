# Route Controllers

Page-specific UI controllers live here so `js/router.js` can stay focused on app shell concerns: auth guard, navigation, sidebar normalization, and shared browser behavior.

Each route registers itself on `window.edenPageControllers` using the HTML filename as the key.

Example:

```js
window.edenPageControllers['supplier_inventory.html'] = bindInventoryPage;
```

Use one folder per department or closely related page group:

- `inventory/page.js` controls `supplier_inventory.html`
- `production/page.js` controls `production_monitoring.html` and `production_quality_control.html`

Future route folders should keep page rendering, button handlers, and page-specific workflow logic out of `js/router.js`.
