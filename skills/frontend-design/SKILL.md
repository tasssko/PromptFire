---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use when asked to build or style web components, pages, landing pages, dashboards, posters, applications, React components, HTML/CSS layouts, or to beautify any web UI while avoiding generic AI aesthetics.
---

# Frontend Design

## Core Workflow

1. Clarify intent before coding.
- Identify purpose, audience, constraints, and implementation target (HTML/CSS/JS, React, Vue, existing design system).
- If requirements are incomplete, make pragmatic assumptions and proceed.

2. Choose a bold, explicit visual direction.
- Commit to one strong aesthetic (for example: brutalist raw, editorial magazine, retro-futurist, playful toy-like, luxury refined, industrial utilitarian).
- Define one memorable differentiator that makes the interface unmistakable.

3. Build a cohesive design system in code.
- Define CSS variables for palette, spacing rhythm, type scale, radii, and effects.
- Pair a distinctive display typeface with a readable body typeface.
- Avoid overused defaults and generic stacks (`Inter`, `Roboto`, `Arial`, system defaults) unless the existing product already uses them.

4. Compose an intentional layout.
- Prefer asymmetry, overlap, diagonal flow, controlled contrast, and deliberate negative space when they reinforce the concept.
- Avoid cookie-cutter section patterns unless explicitly required.

5. Add high-impact motion.
- Prioritize a few meaningful animations: load sequence, staggered reveals, scroll-triggered moments, and deliberate hover/focus transitions.
- Use CSS-first animations for static HTML; use Motion libraries in React when appropriate.

6. Polish for production.
- Ensure responsiveness on desktop and mobile.
- Preserve accessibility basics: semantic structure, keyboard reachability, focus visibility, and readable contrast.
- Match implementation complexity to the design direction: maximalist concepts need rich detail; minimalist concepts need disciplined restraint.

## Design Constraints

- Never default to generic AI aesthetics (especially purple-heavy gradients on white, predictable layouts, or interchangeable component styling).
- Vary visual language across outputs; do not converge on one repeated look.
- Keep the final output functional first, then expressive.

## Output Expectations

Deliver working frontend code that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear point of view
- Refined in typography, color, composition, and motion
