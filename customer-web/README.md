# React + Vite

## Deploying on Hostinger

Build the website from the `customer-web` directory:

```powershell
npm run build
```

Upload the **contents** of `customer-web/dist` into the domain's Hostinger
document root (usually `public_html`), including `index.html`, the `assets`
folder, and the hidden `.htaccess` file. Do not upload the source folder or put
the `dist` folder itself inside `public_html`; the document root must contain
`index.html` directly. The `.htaccess` file also routes direct requests such as
`/driver` back to the single-page app.

## Booking confirmation SMS

After a booking is saved, the `booking-otp` Edge Function sends the customer a
confirmation SMS through MSG91. The booking form also shows whether the SMS was
sent. The driver calls the customer separately to confirm the trip. Drivers can
review and contact customers in `/driver`.

## Automatic WhatsApp booking notifications

The `booking-otp` Edge Function saves the booking first, then sends a WhatsApp
template notification to the configured business recipient. To enable it,
configure Meta WhatsApp Business Cloud API and create an approved Utility
template named `new_booking_alert` in English (`en`) with this body and
placeholders in this exact order:

```text
New taxi booking #{{1}}
Customer: {{2}}
Phone: {{3}}
Trip: {{4}}
Pickup: {{5}}
Drop: {{6}}
Travel date: {{7}} at {{8}}
Car: {{9}}
```

Set these as **Supabase Edge Function secrets**. Use a Cloud API-enabled sender
number and a recipient number that can receive the notification; keep the
recipient separate from the sender number.

- `WHATSAPP_ACCESS_TOKEN`: Meta Cloud API access token
- `WHATSAPP_PHONE_NUMBER_ID`: Cloud API sender's phone number ID
- `WHATSAPP_BOOKING_RECIPIENT`: recipient number with country code, digits only (for example `918438001838`)
- `WHATSAPP_BOOKING_TEMPLATE_NAME`: approved template name (`new_booking_alert`)
- `WHATSAPP_BOOKING_TEMPLATE_LANGUAGE`: approved template language code (`en`)
- `WHATSAPP_GRAPH_API_VERSION`: supported Meta Graph API version (for example `vXX.0`)

Never put the access token in frontend code or `.env` files. After setting the
secrets in Supabase, deploy the function:

```powershell
npx supabase functions deploy booking-otp
```

If WhatsApp is not configured or Meta rejects the notification, the booking
remains saved in Supabase and the website displays a manual WhatsApp fallback.

In MSG91, configure and approve a transactional SMS Flow/DLT template with
three variables, in this order: customer name (`VAR1`), booking ID (`VAR2`),
and trip details (`VAR3`). The message should tell the customer that the booking
request was received and that the driver will call to confirm.

Set these as **Supabase Edge Function secrets** (do not put the MSG91 auth key
in the frontend `.env` file):

- `MSG91_AUTH_KEY`: the MSG91 auth key
- `MSG91_CONFIRMATION_TEMPLATE_ID`: the approved MSG91 Flow template ID

Apply database migrations and deploy the Edge Function:

```powershell
npx supabase db push
npx supabase functions deploy booking-otp
```

If MSG91 is not configured or its API rejects the request, the booking remains
saved and the website tells the customer that the SMS could not be sent.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
