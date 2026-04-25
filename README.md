# Smart Meal Planner MVP

Bu surumde proje, `Node.js + Express + SQLite` backend ile nutrition DB'ye baglidir ve
`LM Studio` ile plan aciklamasi uretebilir.

## Ozellikler

- Kullanici onboarding: alerji, butce, hedef, diyet tercihleri
- Hard-rule alerjen filtreleme
- TDEE tabanli kalori/makro hedefleri
- Haftalik plan + alisveris listesi
- Nutrition ve fiyat hesaplari DB uzerinden
- LM Studio ile plan aciklamasi ve alternatif oneriler

## Kurulum

1. Projeyi ac:
   - `C:\Users\Yoga\meal-planner-mvp`
2. Paketleri kur:
   - `npm install`
3. Ortam degiskenlerini ayarla:
   - `.env.example` dosyasini `.env` olarak kopyala
   - Gerekirse `LM_STUDIO_MODEL` degerini degistir
4. Sunucuyu calistir:
   - `npm start`
5. Tarayicida ac:
   - [http://localhost:3000](http://localhost:3000)

## LM Studio Baglantisi

1. LM Studio'yu ac
2. Bir model yukle (chat modeli)
3. Local server'i aktif et (`OpenAI compatible API`)
4. Varsayilan endpoint:
   - `http://127.0.0.1:1234/v1`
5. `.env` icindeki `LM_STUDIO_MODEL` degerini LM Studio'daki model adi ile eslestir

## API Endpoints

- `GET /api/health`
- `GET /api/foods?query=&preference=&excludeAllergens=`
- `GET /api/foods/:id/nutrition?grams=`
- `GET /api/foods/:id/price?grams=`
- `POST /api/llm/meal-explanation`

## DB Notu

- Dosya: `nutrition.db`
- Seed veri ilk calistirmada otomatik yuklenir
- Sonraki adimda USDA FoodData Central ingest pipeline eklenebilir

## Guvenlik Notu

Bu uygulama tibbi tavsiye degildir. Alerji riski olan kullanicilar profesyonel destek almalidir.
