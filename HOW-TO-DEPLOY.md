# Ivan Amad Portfolio — Backend Setup & Deployment

## What was built

| File | Purpose |
|---|---|
| `server.js` | Express backend — serves your site, handles uploads, admin auth |
| `package.json` | npm dependencies |
| `setup.js` | One-time script to set your admin password |
| `.env.example` | Environment variable template |
| `admin/index.html` | Admin panel (upload artwork, manage galleries, toggle password protection) |
| `public/ivan-amad.html` | Your portfolio — loads real images from the backend automatically |
| `public/enter.html` | Site password gate page (only shown if you enable it in admin settings) |

---

## Step 1 — Install Node.js

Download from https://nodejs.org (pick the LTS version). This is a one-time install.

---

## Step 2 — Install dependencies

Open a terminal in your `Portfolio website` folder and run:

```
npm install
```

---

## Step 3 — Set your admin password

```
node setup.js
```

It will ask you to enter and confirm a password, then save it to a `.env` file automatically.

---

## Step 4 — Run the server locally (for testing)

```
npm start
```

Then open your browser:
- **Your portfolio:** http://localhost:3000
- **Admin panel:** http://localhost:3000/admin

---

## Step 5 — Upload your artwork

1. Go to http://localhost:3000/admin
2. Enter your admin password
3. Pick a chapter from the sidebar (e.g. Concept Art)
4. Upload images:
   - **Cover** — the full-bleed image behind the chapter title
   - **Gallery** — individual artwork cards in the horizontal gallery
   - **Strips** — the small film-strip thumbnails
   - **Mosaic** — the 3-slot layout (left · center tall · right)
5. Changes appear on the portfolio immediately — no code editing needed

---

## Step 6 — Deploy to the internet (Railway — free)

Railway is the easiest free option.

1. Go to https://railway.app and create a free account
2. Click **New Project → Deploy from GitHub**
   - Or use **New Project → Empty Project**, then connect your folder
3. Add your environment variables in Railway's dashboard:
   - Copy everything from your `.env` file into Railway's **Variables** tab
4. Railway will detect `package.json` and run `npm start` automatically
5. Your site gets a free `.railway.app` URL instantly

**Persistent file storage on Railway:**
Railway's disk resets on redeploy. To keep uploaded images permanently, set up a free [Cloudinary](https://cloudinary.com) or [Backblaze B2](https://www.backblaze.com/b2) account and store images there instead of locally. (I can add Cloudinary support if you want this.)

---

## Optional — Password protect your site

1. Go to http://localhost:3000/admin → **Settings**
2. Toggle **Password Protect Site** on
3. Enter a visitor password and click Save
4. Visitors will see a password entry screen before they can view the portfolio

---

## Folder structure after setup

```
Portfolio website/
├── server.js           ← backend
├── package.json
├── setup.js
├── .env                ← your passwords (do NOT share this file)
├── admin/
│   └── index.html      ← admin panel
├── public/
│   ├── ivan-amad.html  ← portfolio site
│   ├── enter.html      ← site password page
│   └── images/         ← uploaded artwork (auto-created)
│       ├── concept-art/
│       ├── storyboards/
│       └── ...
└── data/
    ├── gallery.json    ← image metadata (auto-created)
    └── settings.json   ← site password settings (auto-created)
```
