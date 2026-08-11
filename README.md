# Soulmates — Real Mobile App MVP

This is a real React Native/Expo project for Android and iPhone, connected to Supabase for authentication and data.

## What is implemented
- Email/password account creation and login
- Profile creation and photo selection
- Location permission and location storage
- Discovery profiles
- Like/pass flow
- Database-backed mutual matching
- Matches screen
- Messages screen foundation
- Block/report database tables
- Row Level Security policies

## Setup

1. Install Node.js 22.13+.
2. Create a Supabase project.
3. In Supabase SQL Editor, run `supabase/schema.sql`.
4. Copy `.env.example` to `.env`.
5. Put your Supabase project URL and publishable key in `.env`.
6. Install packages:
   `npm install`
7. Start:
   `npx expo start`

For Android or iPhone, Expo's current SDK documentation supports a shared Android/iOS codebase. Supabase's current Expo guidance supports Auth, Postgres and Storage integration.

## Important production work before store launch
- Configure Supabase Storage and secure photo uploads.
- Add realtime chat UI and message composer.
- Add Apple/Google sign-in.
- Add age/identity verification.
- Add moderation/admin dashboard.
- Add subscriptions and store billing.
- Add privacy policy, terms, community guidelines and account deletion.
- Test abuse prevention, rate limits, location privacy and RLS thoroughly.
- Create App Store and Google Play developer accounts and app signing credentials.

This repository is the production foundation, but the assistant cannot create your Apple/Google developer accounts or a live Supabase project on your behalf without your accounts/credentials.
