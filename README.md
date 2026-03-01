# triad-arena

## Installation

```bash
cd server && npm install
cd client && npm install
```

## Server .env example

```env
PORT=3001
CLIENT_URL=http://localhost

DB_NAME=triad_arena
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=db
DB_PORT=5432

JWT_SECRET=super_secret_key
```

## Run in development

```bash
cd server && npm run dev
cd client && npm run dev
```

## Production Deployment (Docker + Nginx)

Container architecture:
- `db`: PostgreSQL 15 data store.
- `server`: Node.js API (Express + Sequelize) on port `3001` inside Docker network.
- `client`: Built Vite static app served by Nginx in the client container.
- `nginx`: Public reverse proxy on host port `80`, forwarding `/api` and `/socket.io` to backend and `/` to client.

1. Start stack:

```bash
docker-compose up --build -d
```

2. Run migrations:

```bash
cd server
npx sequelize-cli db:migrate
```

3. Stop containers:

```bash
docker-compose down
```

4. Rebuild and restart:

```bash
docker-compose up --build -d
```

5. Access logs:

```bash
docker-compose logs -f
```

Service-specific logs:

```bash
docker-compose logs -f nginx
docker-compose logs -f server
docker-compose logs -f client
docker-compose logs -f db
```
