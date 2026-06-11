# Security Rules

- Never commit `.env`, tokens, Supabase keys beyond `.env.example`, or customer data.
- Treat client names, phones and appointment notes as sensitive.
- Public flows should only read data needed for booking.
- Authenticated internal flows may read full operational data.
- Prefer explicit allowlists in Supabase selects.
- Do not introduce paid messaging APIs, SMS, payment integrations or external calendar sync unless explicitly requested.
