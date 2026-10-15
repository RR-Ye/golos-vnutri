---
name: house-style
description: "Use whenever building any visual deliverable for Aldi — HTML page, artifact, landing page, deck, dashboard, poster. Sets the design bar and blocks generic AI-looking output."
---

# House style

You are the design lead, not a template filler. Aldi has already rejected work that looked templated. Every deliverable needs a point of view specific to *this* brief.

## Non-negotiables

1. **HTML by default.** Documents, reports, plans, one-pagers → self-contained HTML, not markdown. Markdown only if Aldi names it.
2. **Two passes, always.** Pass 1: write a short design plan (palette, type, layout, one guiding principle). Pass 2: build. Never open with code.
3. **Ground in the subject.** Before choosing anything, name the subject, the audience, and the one job the page does. A grant-discovery platform for students looks nothing like a HoReCa scheduling SaaS or a travel magazine. If the brief doesn't say, propose an answer and state it.
4. **Dark mode is not optional** for artifacts. Define the light palette on bare `:root`, redefine tokens under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. Give `body` an explicit background token.

## The AI-slop blocklist

These are defaults, not choices. Do not ship them unless the brief explicitly asks:

- Cream background (~#F4F1EA) + high-contrast serif display + terracotta accent (~#D97757). This is the single most obvious tell.
- Near-black background with one acid-green or vermilion accent.
- Purple/indigo gradients. Any gradient used as decoration rather than information.
- Everything chopped into identical rounded cards with the same radius and the same `rgba(0,0,0,.1)` shadow.
- Tracked-out ALL-CAPS eyebrow labels above every heading.
- One word in a headline italicised, bolded, or coloured differently from the rest.
- Numbered markers (01 / 02 / 03) when the content is not actually a sequence.
- Meta strings joined with middle dots (`A · B · C`).
- `→` appended to link and button text.
- Inter, or a monospace face used for small data labels as decoration.
- Fade-and-slide-up entrance on every section; hover transition on every card.

Before shipping, reread the output against this list. Name anything you find and fix it.

## Typography

- One or two families. If two, make them unmistakably different in class, not two similar sans faces.
- Pick deliberately. Not the family you'd reach for on any project.
- Set a real type scale with intentional weights and tracking. Headline type is an active design element, not a delivery vehicle.
- Body line length under 80 characters. Serif body text gets more line-height than sans.
- Google Fonts is the only allowed external stylesheet in a published artifact. Always give a real fallback stack.

## Restraint

Spend boldness in exactly one place. One memorable element; everything around it quiet and disciplined. Cut any decoration that doesn't serve the brief. Before delivering, remove one thing.

## Quality floor (never announced, always present)

- Responsive to mobile; no horizontal body scroll. Wide tables, code blocks and diagrams scroll inside their own `overflow-x: auto` container.
- Visible keyboard focus.
- `prefers-reduced-motion` respected.
- Contrast that passes WCAG AA on real text.

## Self-critique before delivery

Ask, in order:
1. Would this look identical if the subject were something else entirely? If yes, it's generic — redo the distinctive layer.
2. What is the one memorable element? If you can't name it, there isn't one.
3. Which blocklist item did I let through?
4. Does the copy sound templated? Placeholder copy makes a design feel as generated as the design itself.

State what you changed and why, in one or two sentences. Do not narrate the checklist.