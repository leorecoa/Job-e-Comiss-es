# Branded design system

## Principles

Job e Comissoes is an operational tool for barbershops. The visual language uses warm ivory and sand, charcoal text, restrained aged brass, deep green for success, and terracotta for destructive states. Surfaces are solid, shadows are quiet, radii are moderate, and focus is always visible.

Typography pairs IBM Plex Sans for dense operational reading with Fraunces for short product headings. Motion is optional and must communicate state rather than decorate the interface.

## Semantic palette

Tokens live in `styles.css`: `background`, `foreground`, `surface`, `surface-muted`, `border`, `primary`, `primary-hover`, `primary-foreground`, `accent`, `success`, `warning`, `destructive`, `muted`, `focus-ring`, and `disabled`. Components must consume these meanings instead of spreading color names through JSX. Radius, surface shadow, field spacing, and font families are tokens too.

## Foundations

`components/ui.tsx` provides `Button`, `Input`, `Label`, `Textarea`, `Surface`, `Badge`, `FieldMessage`, `PageHeader`, and `EmptyState`. Props stay close to native HTML, accept `className`, and preserve keyboard behavior. Loading buttons expose `aria-busy`; labels and field messages use native IDs and ARIA relationships.

## Usage rules

- Use one primary action per region; brass is an accent, not a background default.
- Prefer layout and spacing before adding another surface.
- Use success, warning, and destructive colors only for their semantic state.
- Keep focus-visible styles intact and connect labels, controls, and errors.
- Avoid glassmorphism, decorative gradients, gold glow, oversized radii, and cards around every group.
- Do not copy shadcn/ui themes. It is only a structural reference for small, composable APIs.

## Gradual migration

Authentication and owner onboarding share `AuthLayout`: a mobile-first ivory workspace with one primary surface, a compact product mark, and stable vertical spacing. Async processing uses `LoadingState`; recoverable feedback uses `InlineNotice` with polite or assertive live regions according to severity.

Forms keep labels above controls, required fields explicit, one primary submit action, and messages associated through IDs. Fraunces is reserved for page and state titles; all controls and operational copy use IBM Plex Sans. At narrow widths the layout becomes one column without hiding actions, and reduced-motion preferences remove the authentication entrance animation.

Future PRs should migrate one bounded area at a time, preserve behavior and tests, and remove old page-specific classes only after visual and accessibility review. Dashboard, agenda, finance, and public booking remain unchanged until separately scoped.

The owner operational shell separates navigation from feature content. Desktop uses a persistent charcoal navigation region; mobile uses a labelled, dismissible panel with the same destinations. Active destinations combine `aria-current` with a brass inset marker, section headers stay compact, and long tenant or account names truncate without changing their accessible text. Feature-specific cards, tables, forms, and loading rules remain owned by their bounded content areas.
