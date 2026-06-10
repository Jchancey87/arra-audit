# 🚀 Quick Start (5 Minutes)

## 1. Install & Setup

```bash
cd "c:\Users\jchancey\Documents\Homma Research"
npm run install-all
```

Create `.env` file in root with your API keys:
```env
PORT=5050
NODE_ENV=development
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/arra
JWT_SECRET=any-random-secret-key
OPENAI_API_KEY=sk-your-openai-key
TAVILY_API_KEY=your-tavily-key
REACT_APP_API_URL=http://localhost:5050
```

## 2. Start the App

```bash
npm run dev
```

Open **http://localhost:3050**

## 3. First Run

1. **Register**: Create an account
2. **Import**: Paste a YouTube URL (try a Radiohead or Beach Boys song!)
3. **Select Lenses**: Pick 1-2 to start (e.g., "rhythm" and "harmony")
4. **Audit**: Answer the AI-generated questions while listening
5. **Log**: Capture one technique you learned
6. **Save**: Click "Save Audit"

## 4. Explore

- **Dashboard**: See all your imported songs
- **Technique Notebook**: Browse everything you've learned
- **Create More Audits**: Study the same song from different lenses

---

## What Happens Behind the Scenes

1. **Import**: YouTube metadata extracted via oembed
2. **Research**: Tavily searches for production info about the song
3. **Template**: GPT-4 generates custom audit questions based on the song + artist style
4. **Audio**: YouTube video embedded in the audit form
5. **Save**: All responses, bookmarks, and techniques stored in MongoDB
6. **Notebook**: Techniques indexed by lens and artist for easy browsing

---

## Example: Studying "Paranoid Android" by Radiohead

**Lens:** Arrangement  
**Questions GPT might generate:**
- "What sections exist? Map them with bar counts"
- "How do transitions work? What instrument leads each section change?"
- "Where does tension peak? How?"
- "What makes the final section different from the intro?"

**Technique you might log:**
- "Radiohead: Fake-out final chorus - builds to expected climax but drops back to bridge instead"
- Category: Arrangement
- You can search for this later when writing your own song

---

**Next Steps:** Read [SETUP.md](./SETUP.md) for detailed configuration, or jump to [README.md](./README.md) for full docs.
