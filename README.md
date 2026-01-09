# Family Hub

A modern family command center built with Next.js 14, React, and Tailwind CSS. Manage your family's calendar, tasks, shopping lists, and notes all in one place.

## Features

- **Dashboard** - Overview of upcoming events, tasks, shopping items, and notes
- **Calendar** - Family event scheduling with color-coded members
- **Tasks** - Chore management with assignments and priority levels
- **Shopping List** - Shared grocery list synced with Recipe Vault
- **Notes** - Pin important family notes and reminders

## Tech Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Supabase (shared with Recipe Vault)
- Lucide React Icons

## Shopping List Integration

The shopping list syncs with [Recipe Vault](https://github.com/bingobangobongo929/recipe-vault) via a shared Supabase backend:

- **Recipe ingredients** added in Recipe Vault appear here
- **Manual items** (nappies, household items) can be added directly
- **Synced across both apps** - check off items from either place

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase project (same as Recipe Vault)

### Installation

```bash
# Clone the repository
git clone https://github.com/bingobangobongo929/family-hub.git

# Navigate to project directory
cd family-hub

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Add your Supabase credentials to .env.local
# Use the same Supabase project as Recipe Vault

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Environment Variables

Create a `.env.local` file with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Use the **same Supabase project** as Recipe Vault to share the shopping list.

## Deployment on Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

The app works in demo mode without Supabase configured.

## Project Structure

```
family-hub/
├── app/
│   ├── calendar/
│   ├── notes/
│   ├── shopping/
│   ├── tasks/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Card.tsx
│   └── Sidebar.tsx
├── lib/
│   ├── database.types.ts
│   └── supabase.ts
├── public/
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## License

MIT
