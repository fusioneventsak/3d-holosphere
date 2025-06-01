# PhotoSphere - 3D Photo Collages

Create stunning 3D photo collages for events where attendees can contribute photos in real-time. Photos appear in an interactive 3D environment with customizable animations, lighting, and effects.

![PhotoSphere Demo](https://images.pexels.com/photos/1266810/pexels-photo-1266810.jpeg)

## Features

- **Anonymous Photo Uploads**: Event attendees can upload photos using just a code - no login required
- **Real-time Updates**: Photos appear instantly in the 3D environment
- **Customizable 3D Scenes**: Control colors, lighting, animations, and more
- **Multiple Animation Patterns**:
  - Grid Wall: Classic photo wall layout
  - Float: Photos float upward like bubbles
  - Wave: Rippling wave motion
  - Spiral: Dynamic spiral arrangement
- **Photo Moderation**: Event owners can review and remove photos
- **Responsive Design**: Works on desktop and mobile devices
- **Performance Optimized**: Handles up to 500 photos smoothly

## Tech Stack

- **Frontend**: React + Vite, TypeScript
- **3D Graphics**: React Three Fiber, Three.js
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Auth, Database, Storage)
- **Routing**: React Router
- **State Management**: Zustand

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/photosphere.git
cd photosphere
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Update `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
```

## Project Structure

```
src/
├── components/         # React components
│   ├── auth/          # Authentication components
│   ├── collage/       # Collage-related components
│   ├── layout/        # Layout components
│   ├── routes/        # Route components
│   └── three/         # 3D scene components
├── lib/               # Utility functions
├── pages/             # Page components
├── store/             # State management
└── types/             # TypeScript types
```

## Key Routes

- `/`: Landing page
- `/join`: Enter collage code
- `/collage/:code`: View collage and upload photos
- `/dashboard`: Manage collages (auth required)
- `/collage/:code/moderation`: Moderate photos (auth required)

## Database Schema

### Tables

- `collages`: Stores collage metadata
- `photos`: Stores photo references
- `collage_settings`: Stores 3D scene configuration
- `users`: Links to auth.users
- `user_roles`: Role management

### Storage

- `photos` bucket: Stores uploaded photos

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details