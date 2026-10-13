# Deploying Stringtopia

Three services, all with free plans: **MongoDB Atlas** (database), **Render** (API), **Vercel** (website).
Choose **Frankfurt** for Atlas and Render, it is the closest to Egypt.

## 0. Before you start
```bash
cd server && npm install && npm test   # creates package-lock.json and runs the tests
cd ../client && npm install && npm run build   # catches errors before Vercel does
cd .. && git init && git add . && git commit -m "Stringtopia"
# create an empty repository on github.com, then:
git remote add origin https://github.com/YOUR-NAME/stringtopia.git
git branch -M main && git push -u origin main
```
Commit the two `package-lock.json` files too, so every deploy installs the same versions.

## 1. Database: MongoDB Atlas
1. Create a free **M0** cluster (AWS, Frankfurt).
2. **Database Access**: add a user with a strong password (letters and numbers keep it simple).
3. **Network Access**: add `0.0.0.0/0`. Render's free plan has no fixed IP, so the password is your protection.
4. **Connect > Drivers**: copy the connection string and add the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/stringtopia?retryWrites=true&w=majority`

## 2. API: Render
1. **New > Blueprint**, pick your GitHub repo. Render reads `render.yaml`.
2. Fill in the prompts: `MONGO_URI` (from step 1), `CLIENT_URL` (type `http://localhost:3000` for now),
   `ADMIN_EMAIL`, `ADMIN_PASSWORD` (strong, you log in to /admin with it), `PICKUP_ADDRESS`,
   `DELIVERY_FEE` (in piasters: `5000` = 50 EGP). Apply.
3. When it is live, open `https://YOUR-SERVICE.onrender.com/api/health`. You should see `{"ok":true}`.
4. **Environment** tab: add the rest, using the names in `server/.env.example`:
   `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_IDS`,
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `NOTIFY_EMAIL`.
   (`API_URL` is not needed on Render: the service's own address is used automatically.)

## 3. Website: Vercel
1. **Add New > Project**, import the same repo.
2. Set **Root Directory** to `client`.
3. Add the environment variable `NEXT_PUBLIC_API_URL` = `https://YOUR-SERVICE.onrender.com/api`
   (it must end in `/api`). Deploy. If you change it later, redeploy: it is baked in at build time.

## 4. Connect them
Back on Render, set `CLIENT_URL` to your Vercel address (no trailing slash). The service restarts.
This controls CORS and the links in emails and Paymob redirects.

## 5. Check everything
- [ ] Log in at `/login` with your admin email, then open **Admin > Products** and add a product with photos.
- [ ] Buy it as a guest, pay with a Paymob **test** card (numbers are in Paymob's docs), land on the thank-you page.
- [ ] The order appears in **Admin > Orders**. Mark it shipped.
- [ ] Set a product's stock to 0 and try a reservation: request, approve, pay.
- [ ] When your Paymob account is activated, swap in the live keys and live integration IDs.

## Free-plan limits to know about
- **Render free** sleeps after 15 minutes without visits. The next visit waits about a minute, and Paymob's
  payment confirmations could arrive while it is asleep. Fine for a demo; for real sales use the paid
  Starter plan (always on).
- **Vercel's free (Hobby) plan** is for personal, non-commercial use. A real store needs their paid plan.
- **Atlas M0** has 512 MB of storage, plenty for a small shop.
