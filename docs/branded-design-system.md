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

Authentication is the first low-risk demonstration. Future PRs should migrate one bounded area at a time, preserve behavior and tests, and remove old page-specific classes only after visual and accessibility review. Dashboard, agenda, finance, onboarding, and public booking remain unchanged until separately scoped.
