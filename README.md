# Thattu Food Delivery

Responsive full-stack web app/PWA intended to work on desktop and mobile browsers. It can be installed on supported phones from the browser after it is served over HTTPS. This is a demo/MVP, not yet a production food-delivery business deployment.

## Run on Windows

Requirements: Node.js 22.13 or later (Node.js 24 is supported by the built-in SQLite API).

1. Extract this ZIP to a folder such as `C:\Users\Asus\Downloads\Thattu-App`.
2. Open that exact folder. You must see `package.json`, `server.js`, and `public` directly inside it.
3. Click the File Explorer address bar, type `cmd`, and press Enter.
4. Run these commands one at a time:

```cmd
npm install
copy .env.example .env
npm start
```

If Windows asks whether to overwrite `.env`, type `N` unless you deliberately want to replace your existing settings.

5. On the PC, open http://localhost:3000.

## Use on a phone

For phone use from anywhere, deploy this app to an HTTPS host and open the public HTTPS URL on the phone. On Android Chrome, use the browser menu and choose **Install app** or **Add to Home screen**. The PC and phone will then use the same online server/database. `localhost` on the phone is not the same as `localhost` on the PC.

## Demo accounts

- Customer: `customer@thattu.demo` / `CustomerDemo!2026`
- Restaurant: `restaurant@thattu.demo` / `RestaurantDemo!2026`
- Delivery: `delivery@thattu.demo` / `DeliveryDemo!2026`
- Admin: `admin@thattu.demo` / `AdminDemo!2026`

## What works in this MVP

- Responsive restaurant discovery and search
- Menu browsing, cart, server-calculated order totals
- Customer registration/login, checkout and order history/status
- Restaurant, delivery partner, and admin dashboards
- Installable PWA shell for supported browsers

## Important limitations before real public launch

- UPI/card options are demo selections; no real payment is collected.
- Restaurant/menu data are seeded examples; restaurant dashboard is tied to the first seeded restaurant.
- No live GPS tracking, OTP/SMS, push notifications, or real restaurant onboarding.
- Local SQLite is suitable for a demo only. For an online multi-user launch, move to a persistent PostgreSQL database and configure backups.
- Do not use demo credentials for a public production deployment. Set a strong `JWT_SECRET`, change/remove demo accounts, and review security, privacy, food licensing and operational requirements.

## Deploying online

The app must be deployed to an HTTPS hosting service to be available on both devices from anywhere. This requires your own hosting/Git provider account and configuration; this ZIP does not itself publish a public URL. Do not use the SQLite database on an ephemeral free host for real orders.
