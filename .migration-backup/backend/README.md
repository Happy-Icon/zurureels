# ZuruReels Backend

This directory contains the backend resources for ZuruReels.

## 🗄️ Database (Supabase)
This project uses Supabase for Authentication, Database, and Realtime capabilities.

### Schema
The database schema is documented in [schema.sql](./schema.sql).
Key tables:
- `profiles`: User information.
- `payment_methods`: Securely stored Paystack authorization tokens.
- `bookings`: Trip and event bookings.

## 🛠️ Setup
1.  Ensure you have access to the Supabase Project.
2.  Run the SQL from `schema.sql` in the Supabase SQL Editor if setting up a fresh instance.

## 💳 Payments (Paystack)
-   Payments are processed on the frontend using `react-paystack`.
-   Successful transactions are recorded in the `bookings` table.
-   Reusable Authorization Codes are stored in `payment_methods` to enable 1-click checkout.
