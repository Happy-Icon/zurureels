# Supabase Management Workflow

To ensure a robust and scalable backend for ZuruReels, we follow a structured workflow for managing database changes and serverless logic.

## 1. Database Migrations

For any changes to the database schema (e.g., adding tables, updating RLS policies), I will use the **Supabase CLI**. This allows us to track versioned changes and ensure environment consistency.

### Workflow:
1.  **Generate a new migration**:
    ```bash
    npx supabase migration new <migration_name>
    ```
    This creates a new `.sql` file in `supabase/migrations/`.
2.  **Edit the migration**: I will add the necessary SQL (like the `experiences` table definition) to this file.
3.  **Apply local changes**:
    ```bash
    npx supabase db reset
    ```
4.  **Deploy to Production**:
    ```bash
    npx supabase db push
    ```

## 2. Supabase Edge Functions

Edge Functions (like `city-pulse-ai`) are written in TypeScript and run in a Deno environment.

### Workflow:
1.  **Create a new function**:
    ```bash
    npx supabase functions new <function_name>
    ```
2.  **Local Testing**: I use the local serve command to test functions before deployment:
    ```bash
    npx supabase functions serve <function_name> --no-verify-jwt
    ```
3.  **Deploying**: Once verified, I deploy the function to the live Supabase project:
    ```bash
    npx supabase functions deploy <function_name> --project-ref <your-project-id>
    ```

## 3. Environment Secrets

For sensitive keys (like `LOVABLE_API_KEY`), I manage them securely via the CLI:
```bash
npx supabase secrets set LOVABLE_API_KEY=your_key_here
```

---
> [!NOTE]
> All migration files and function code are stored in the `backend/supabase/` directory to maintain a clear separation of concerns.
