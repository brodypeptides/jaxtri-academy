# Jaxtri Academy — Cloudflare Foundation

This is the first Cloudflare-ready foundation for the Jaxtri Labs Affiliate Program + private Jaxtri Academy.

## What is included

- Public marketing site: **Jaxtri Labs Affiliate Program**
- Public application page
- Affiliate login preview
- Owner login preview
- Private **Jaxtri Academy** app preview
- Owner dashboard preview
- Owner content manager preview
- Application approval architecture
- Cloudflare Pages Functions API scaffold
- D1 database schema

## Current state

This version still works as a static website, but it is structured for Cloudflare backend features.

Preview login uses localStorage only. It is not real security yet.

## Cloudflare setup

Cloudflare Pages settings for now:

- Framework preset: None
- Build command: blank
- Build output directory: `/`

## Backend next steps

1. Create a Cloudflare D1 database.
2. Run `schema.sql` against the database.
3. Add the D1 binding as `DB`.
4. Replace preview localStorage login with real auth/session endpoints.
5. Connect application approval to real user creation.
6. Connect content manager to real published content.

## Important links used

- Main site: https://jaxtrilabs.com/
- Discord: https://discord.gg/5ASbmvde8d
- Manager email: Brodypeptides@gmail.com
- Owner email: jaxtrilabs@gmail.com
