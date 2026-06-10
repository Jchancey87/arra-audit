# Setup Guide - Arra Audit App

This guide will walk you through setting up and running the Arra Audit App locally.

## Prerequisites

Before starting, make sure you have:
- **Node.js** 24+ ([download here](https://nodejs.org/))
- **npm** 11+ (comes with Node.js)
- **MongoDB** account (free tier available at [mongodb.com](https://www.mongodb.com/cloud/atlas))
- **OpenAI API Key** ([get one here](https://platform.openai.com/api-keys))
- **Tavily API Key** ([get one here](https://tavily.com/api))

## Step 1: Clone/Navigate to Project

```bash
cd "c:\Users\jchancey\Documents\Homma Research"
```

## Step 2: Install Dependencies

```bash
npm run install-all
```

This will install:
- Root dependencies (concurrently)
- Server dependencies (Express, MongoDB, etc.)
- Client dependencies (React, routing, etc.)

## Step 3: Create .env File

Create a file named `.env` in the root directory with your API keys:

```env
# Server Configuration
PORT=5050
NODE_ENV=development

# Database
# Get MongoDB URI from https://www.mongodb.com/cloud/atlas
MONGODB_URI=mongodb+srv://username:password@cluster-name.mongodb.net/arra?retryWrites=true&w=majority

# JWT Secret (use any long random string)
JWT_SECRET=your-super-secret-key-change-this-in-production-12345

# APIs
# OpenAI: Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-your-actual-key-here

# Tavily: Get from https://tavily.com/api
TAVILY_API_KEY=tvly-your-actual-key-here

# Frontend Configuration
REACT_APP_API_URL=http://localhost:5050
```

### Getting Your API Keys

**OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Copy and paste into `.env`
4. Make sure your account has API credits

**Tavily API Key:**
1. Go to https://tavily.com/api
2. Sign up and create an API key
3. Copy and paste into `.env`

**MongoDB Connection String:**
1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Click "Connect"
3. Choose "Connect your application"
4. Copy the connection string
5. Replace `<username>` and `<password>` with your credentials
6. Paste into `.env`

## Step 4: Start Development Servers

### Option A: Run Both Together (Recommended)

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5050`
- Frontend client on `http://localhost:3050`

### Option B: Run Separately (for debugging)

Terminal 1 - Start the server:
```bash
npm run server
```

Terminal 2 - Start the client:
```bash
npm run client
```

## Step 5: Access the App

Open your browser and go to: **http://localhost:3050**

You should see the Arra Audit login page.

## Step 6: Create an Account

1. Click "Register" 
2. Enter email, password, and name
3. Click "Register"
4. You'll be automatically logged in and redirected to the dashboard

## Step 7: Import Your First Song

1. Click "Import Song"
2. Find a YouTube video you want to study
3. Copy the URL (e.g., `https://www.youtube.com/watch?v=...`)
4. Paste into the import form
5. Click "Import Song"
6. Wait for Tavily research to complete
7. You'll be redirected to create a new audit

## Step 8: Create Your First Audit

1. Select 1-4 lenses:
   - **Rhythm**: How does the groove work? Where are the kicks, hats, bass pockets?
   - **Texture**: What textures and timbres? How is EQ/reverb/delay used?
   - **Harmony**: What chords, progressions, borrowed chords, key changes?
   - **Arrangement**: How is the song structured? What instruments play when?

2. Choose a workflow:
   - **Quick** (5-15 min): See all questions in one form
   - **Guided** (30-60 min): Step through Listen → Sketch → Recreate → Translate → Log

3. Click "Start Audit"

## Step 9: Fill Out the Audit

1. Listen to the song using the embedded YouTube player
2. Answer the AI-generated questions
3. Use the **Bookmark** button to mark interesting moments
4. Log techniques you discover in the "Log Techniques" section
5. Click "Save Audit" when done

## Step 10: View Your Technique Notebook

1. Click "Technique Notebook" in the nav
2. See all techniques you've logged, grouped by lens
3. Search and filter by category or artist
4. Build your personal production vocabulary

## Troubleshooting

### "Cannot find module" error

**Solution**: Install dependencies again
```bash
npm run install-all
```

### MongoDB connection fails

**Check:**
- MONGODB_URI is correct in `.env`
- Your IP is whitelisted in MongoDB Atlas
- Database credentials are correct
- Network access is enabled

**Test connection:**
- Use MongoDB Compass with your connection string
- Or ping: `echo "db.adminCommand('ping')" | mongosh "your-connection-string"`

### "OpenAI API error" or "Cannot generate template"

**Check:**
- `OPENAI_API_KEY` is set correctly in `.env`
- Your OpenAI account has API credits
- API key has not been revoked

**Fallback**: The app uses hardcoded fallback templates if OpenAI fails, so you can still use it

### "Tavily search failed"

**Check:**
- `TAVILY_API_KEY` is set correctly in `.env`
- API key is active

**Fallback**: Research summary will be empty, but audit still works

### "Port 5050 already in use"

**Solution A**: Change PORT in `.env`:
```env
PORT=5051
```

**Solution B**: Kill the process using port 5050:
```bash
# On Windows:
netstat -ano | findstr :5050
taskkill /PID <PID> /F

# On Mac/Linux:
lsof -ti:5050 | xargs kill -9
```

### "React app won't load on localhost:3050"

**Check:**
- Backend is running (`http://localhost:5050/health` should show `{"status":"ok"}`)
- `REACT_APP_API_URL` is set to `http://localhost:5050`

**Solution**: Restart the React dev server
```bash
npm run client
```

## Building for Production

### Build the client:
```bash
npm run build
```

This creates optimized React build in `client/build/`

### Deploy:
1. **Frontend**: Deploy `client/build/` to Vercel, Netlify, AWS S3, etc.
2. **Backend**: Deploy Node.js server to Heroku, Railway, AWS EC2, etc.
3. Update `.env` on server with production API keys and database

## Next Steps

1. Import 2-3 songs from different artists
2. Create audits for each, focusing on different lenses
3. Log techniques from each song
4. Review your Technique Notebook to see patterns
5. Try applying one borrowed technique to your own music

## Tips for Best Results

- **Use headphones**: Better for hearing subtle production details
- **Slow down**: Take your time with each lens (don't try all 4 at once)
- **Repeat listens**: First pass: overview. Second pass: focus on lens questions. Third pass: capture techniques
- **Use sheet music or tabs**: Especially for harmony and rhythm lenses
- **Search similar songs**: Build a library of 3-5 hero tracks per artist to really internalize their style

## Getting Help

If you run into issues:
1. Check the troubleshooting section above
2. Look at the backend logs in terminal (should show MongoDB and API errors)
3. Check browser console (F12 → Console tab) for frontend errors
4. Verify all `.env` values are set and correct

## Architecture Overview

```
User → Browser (React)
           ↓
       http://localhost:3050
            ↓
       Frontend Routes
       - Login/Register
       - Dashboard (song library)
       - Import Song
       - Create Audit
       - Fill Audit Form
       - View Technique Notebook
            ↓
            ↓ API Calls (Axios)
            ↓
       http://localhost:5050
            ↓
       Express Server (Hexagonal Architecture)
       - Auth routes (JWT)
       - Song routes (CRUD + YouTube import)
       - Audit routes (generate templates, save audits)
       - Technique routes (log and retrieve techniques)
            ↓
       External APIs (Adapters):
       - OpenAI (generate audit templates)
       - Tavily (research songs)
       - YouTube (video embedding)
           ↓
           ↓ Database Queries
           ↓
      MongoDB
      - Users
      - Songs
      - Audits
      - Techniques
```

---

**You're ready to start building your musical vocabulary!** 🎵 Happy studying!
