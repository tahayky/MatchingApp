# React Native Expo (TypeScript) Projesi

Bu proje React Native Expo ile oluşturulmuş, TypeScript destekli bir mobil uygulamadır.

## Kurulum

```bash
# Proje bağımlılıklarını yükle
npm install
```

## Kullanım

React Native Expo uygulamasını çalıştırma:

```bash
# Expo Development Server'ı başlat
npm start

# Veya direkt olarak belirli platformları hedefle
npm run android  # Android için
npm run ios      # iOS için
npm run web      # Web için
```

## Proje Yapısı

- `/app` - Expo Router dosyaları ve ekranlar
- `/assets` - Resimler, fontlar ve diğer statik dosyalar
- `/components` - React Native komponentleri
- `/constants` - Sabit değerler ve yapılandırma
- `/hooks` - React custom hooks
- `/services` - API istemcileri ve servisler
- `/types` - TypeScript tip tanımlamaları
- `/utils` - Yardımcı fonksiyonlar ve araçlar

## Geliştirme Notları

- TypeScript: Proje TypeScript ile yapılandırılmıştır, tüm bileşenler ve servisler için tip tanımlamaları kullanılmalıdır.
- Expo: En son Expo sürümü (v52) kullanılmaktadır ve Expo Router ile navigasyon yapılandırılmıştır.
- Modern Expo CLI: Legacy expo-cli yerine modern npx expo CLI kullanılmaktadır (Node 17+ ile uyumlu).
- API Bağlantısı: Backend API'sine bağlantı için `services` klasöründeki modüller kullanılabilir.

## Faydalı Komutlar

```bash
# Testleri çalıştır
npm test

# Linting işlemi çalıştır
npm run lint
