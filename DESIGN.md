---
version: alpha
name: Pentagram
description: Creative agency: mono body, acid-lime cursor, blank canvas.
colors:
  primary: "#0B0B0B"
  secondary: "#6D6D6D"
  tertiary: "#CDFF48"
  neutral: "#F5F3EE"
  surface: "#FFFFFF"
  on-primary: "#FFFFFF"
typography:
  display:
    fontFamily: JetBrains Mono
    fontSize: 4rem
    fontWeight: 500
    letterSpacing: "-0.04em"
  h1:
    fontFamily: JetBrains Mono
    fontSize: 2rem
    fontWeight: 500
  body:
    fontFamily: JetBrains Mono
    fontSize: 0.92rem
    lineHeight: 1.5
  label:
    fontFamily: JetBrains Mono
    fontSize: 0.7rem
    letterSpacing: "0.04em"
rounded:
  sm: 2px
  md: 4px
  lg: 6px
spacing:
  sm: 8px
  md: 16px
  lg: 32px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 12px 20px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: 24px
---
## Overview

A modern creative-agency palette: monospace body, acid-lime cursor/accent, blank-canvas surface.

## Colors

The palette is built around high-contrast neutrals and a single accent that drives interaction.

- **Primary (`#0B0B0B`):** Headlines and core text.
- **Secondary (`#6D6D6D`):** Borders, captions, and metadata.
- **Tertiary (`#CDFF48`):** The sole driver for interaction. Reserve it.
- **Neutral (`#F5F3EE`):** The page foundation.

## Typography

- **display:** JetBrains Mono 4rem
- **h1:** JetBrains Mono 2rem
- **body:** JetBrains Mono 0.92rem
- **label:** JetBrains Mono 0.7rem

## Do's and Don'ts

- **Do** use Tertiary for exactly one action per screen.
- **Do** let Neutral carry the composition — negative space is a feature.
- **Don't** introduce gradients. This system is flat on purpose.
- **Don't** mix Tertiary with alternate accents; the single-accent rule is load-bearing.
