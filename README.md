# triad-arena

## Installation

```bash
cd server && npm install
cd client && npm install
```

## Server .env example

```env
PORT=5000
DATABASE_URL=postgres://...
JWT_SECRET=your_secret
```

## Run in development

```bash
cd server && npm run dev
cd client && npm run dev
```

## Production deployment notes

1. Build client (`cd client && npm run build`).
2. Run server (`cd server && npm run start`).
3. Configure nginx (`nginx/nginx.conf`).
