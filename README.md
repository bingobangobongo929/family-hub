# Family Hub

A modern family command center built with Next.js 14, React, and Tailwind CSS. Manage your family's calendar, tasks, shopping lists, and notes all in one place.

## Features

- **Dashboard** - Overview of upcoming events, tasks, shopping items, and notes
- **Calendar** - Family event scheduling with color-coded members
- **Tasks** - Chore management with assignments and priority levels
- **Shopping List** - Shared grocery list organized by category
- **Notes** - Pin important family notes and reminders

## Tech Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Lucide React Icons

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/family-hub.git

# Navigate to project directory
cd family-hub

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Deployment

This project is configured for easy deployment on Vercel:

1. Push to GitHub
2. Import project in Vercel
3. Deploy automatically

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
├── public/
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## License

MIT
