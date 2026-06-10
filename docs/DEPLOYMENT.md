# Hướng dẫn Deploy

## Frontend (Vercel / Netlify)
1. Build: `npm run build`
2. Deploy folder `dist` lên Vercel

## Backend
- Railway / Render: Connect Git repo, set Environment Variables (MONGO_URI, JWT_SECRET)
- Hoặc Dockerize

## Database
- Sử dụng MongoDB Atlas (free tier)

## Environment Variables
```
MONGO_URI=...
JWT_SECRET=your_super_secret_key
PORT=5000
```

## Domain & HTTPS
Sử dụng Vercel cho frontend + custom domain.

**Production Tips**: Enable CORS đúng origin, rate limiting.