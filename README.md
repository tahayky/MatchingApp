# MatchingApp

Modern bir React Native Expo tabanlı mobil eşleşme (dating) uygulaması.

## Proje Yapısı

Bu uygulama iki ana bileşenden oluşur:

- `backend/`: Express.js ve MongoDB tabanlı RESTful API sunucusu
- `mobile/`: React Native ve Expo tabanlı mobil uygulama

## Kurulum

### 1. Backend Kurulumu

```bash
cd backend
npm install
```

`.env` dosyası oluşturun ve MongoDB URI'nizi ekleyin:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/dating-app
JWT_SECRET=your_jwt_secret_key
```

### 2. Mobil Uygulama Kurulumu

```bash
cd mobile
npm install
```

`.env` dosyasını oluşturun (örnek `.env.example` dosyasından kopyalayabilirsiniz):

```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin:

```
# API Yapılandırması
API_URL_IOS=http://localhost:3000/api
API_URL_ANDROID=http://10.0.2.2:3000/api
API_URL_DEVICE=http://192.168.1.x:3000/api  # Kendi IP adresinizle değiştirin

# Fiziksel cihazda test ederken bunu true yapın
USE_LOCAL_IP=false
```

## Uygulamayı Çalıştırma

### 1. Backend Sunucusunu Başlatın

```bash
cd backend
npm start
```

### 2. Mobil Uygulamayı Başlatın

```bash
cd mobile
npm start
```

## Fiziksel Cihazda Test Etme

Fiziksel bir mobil cihazda test etmek için aşağıdaki adımları izleyin:

1. Bilgisayarınızın yerel IP adresini bulun:
   - Windows: Komut İstemcisinde `ipconfig` komutunu çalıştırın
   - macOS: Terminal'de `ifconfig | grep "inet " | grep -v 127.0.0.1` komutunu çalıştırın

2. `mobile/.env` dosyasını düzenleyin:
   - `API_URL_DEVICE` değerini kendi IP adresinizle güncelleyin (örn. `http://192.168.1.105:3000/api`)
   - `USE_LOCAL_IP` değerini `true` olarak değiştirin

3. Mobil cihazınızın ve bilgisayarınızın aynı Wi-Fi ağına bağlı olduğundan emin olun

4. Expo Go uygulamasını başlatın ve QR kodunu tarayın (veya başka bir yerleşik yöntem kullanın)

## Sorun Giderme

### API Bağlantı Sorunu

Eğer "API Server connection failed" hatası alıyorsanız:

1. Backend sunucunuzun çalıştığından emin olun
2. `.env` dosyasında doğru IP adresi bulunduğundan emin olun
3. Cihazınız ve bilgisayarınızın aynı ağda olduğundan emin olun 
4. Bilgisayarınızın güvenlik duvarı ayarlarını kontrol edin

## Özellikler

- Kullanıcı kimlik doğrulama (kayıt, giriş)
- Profil oluşturma ve düzenleme
- Swipe arayüzü ile profil keşfetme
- Beğenilerin ve eşleşmelerin yönetimi
- API bağlantı test arayüzü

## Teknolojiler

- **Backend**: Node.js, Express, MongoDB, JWT
- **Frontend**: React Native, Expo, TypeScript

## Lisans

MIT
