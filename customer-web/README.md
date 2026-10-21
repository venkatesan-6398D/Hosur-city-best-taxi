# React + Vite

## Booking confirmation SMS

After a booking is saved, the `booking-otp` Edge Function sends the customer a
confirmation SMS through MSG91. The booking form also shows whether the SMS was
sent. The driver calls the customer separately to confirm the trip. Drivers can
review and contact customers in `/driver`.

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
