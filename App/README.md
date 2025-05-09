# MelodyStream - Modern Müzik Dinleme Uygulaması

MelodyStream, YouTube API kullanarak reklamsız ve ücretsiz müzik dinleme imkanı sunan modern bir web uygulamasıdır. Müziğe yatkın kullanıcı arayüzü ile kullanıcı dostu bir deneyim sunar.

#```TELİF HAKLARI NEDENİYLE UYGULAMANIN HİÇBİR TİCARİ AMACI YOKTUR, GELİŞTİRRME AMAÇLI YAPILMIŞTIR."```


![MelodyStream Logo](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAGASURBVFhH7ZY9TsNAEIXfzK4dK0oKJCQKJIoU/AE/QUVJwQ9QUVHwA1RUFBQU/AEVBQUFQqKgQEKioEBCQkJCQrG9O7M0a8d2bMf2JhQc6UjrzLx5b2Z2bQcGBgYGBv4zQohxIcQcY2yWMTbFGBtnjI0xxkYYY8OMsSHG2CBjrJ8x1scY62WM9TDGuhljXYyxTsZYB2OsnTHWxhh7Y4y9MsZeGGPPjLEnxtgjY+yBMXbPGLtjjN0yxm4YY9eMsSvG2CVj7IIxds4YO2OMnTLGThhjx4yxI8bYIWPsgDG2zxjbY4ztMsa2GWNbjLFNxtgGY2ydMbbGGFtljK0wxpYZY0uMsUXG2AJjbJ4xNscYm2WMzTDGphljk4yxCcbYOGNsjDE2yhgbYYwNM8aGGGODjLEBxlg/Y6yPMdbLGOthjHUzxroYY52MsQ7GWDtjrI0x1soYa2GMNTPGmhhjjYyxBsZYHWOsjjFWyxirYYxVM8aqGGOVjLEKxlg5Y6yMMVbKGCthjBUzxooYY4WMsQLGWD5jLI8xlssYy2GMZTPGshhjGYyxNMZYKmMshTGWzBhLYowlMsaSGGPxjLF4xlgcYyyWMRbDGItmjEUxxiIZYxGMsXDGWBhjLJQxFsIYC2aMBTHGAhljAYwxf8aYH2PMlzHmwxgDAPwCQqQZQZQqgFQAAAAASUVORK5CYII=)

## Özellikler

### Kullanıcı Arayüzü
- Modern ve duyarlı (responsive) tasarım
- Spotify benzeri koyu tema
- Glass-effect arka plan tasarımı
- Mobil ve masaüstü uyumlu arayüz
- Hamburger menü ve kenar çubuğu navigasyonu
- Dokunmatik hareketler desteği (swipe gestures)

### Müzik Çalma Özellikleri
- YouTube API entegrasyonu ile geniş müzik kütüphanesi
- Kesintisiz müzik çalma deneyimi
- İleri/geri sarma kontrolü
- Ses seviyesi kontrolü
- Şarkı tekrarlama özelliği
- Rastgele çalma modu
- Çalma listesi desteği
- Şarkı detay sayfası
- Tam ekran oynatıcı modu

### Arama ve Keşif
- Gerçek zamanlı şarkı ve sanatçı araması
- Önerilen şarkılar bölümü
- Popüler çalma listeleri
- Trend müzikler
- Kategori bazlı müzik keşfi

### Kişiselleştirme
- Favori şarkılar listesi
- Özel çalma listeleri oluşturma
- Çalma geçmişi
- Şarkıları favorilere ekleme/çıkarma
- Çalma listelerine şarkı ekleme

### Teknik Özellikler
- Progressive Web App (PWA) desteği
- LocalStorage ile veri saklama
- Responsive tasarım (mobile-first yaklaşımı)
- Touch events desteği
- YouTube IFrame API entegrasyonu

## Kullanılan Teknolojiler

### Frontend
- HTML5
- CSS3 (Flexbox ve Grid layout)
- JavaScript (ES6+)
- Font Awesome ikonları
- Google Fonts

### API ve Entegrasyonlar
- YouTube Data API v3
- YouTube IFrame Player API

### Depolama
- LocalStorage
- SessionStorage

### Tasarım Özellikleri
- CSS Variables
- CSS Grid
- Flexbox
- Media Queries
- CSS Animations
- CSS Transitions
- Glass Effect

## Kurulum

1. Projeyi klonlayın:
\`\`\`bash
git clone https://github.com/Erkan3034/MelodyStream.git
\`\`\`

2. YouTube API anahtarını alın:
   - Google Cloud Console'a gidin
   - Yeni bir proje oluşturun
   - YouTube Data API v3'ü etkinleştirin
   - API anahtarı oluşturun

3. API anahtarını projeye ekleyin:
   - \`index.html\` dosyasında \`YOUTUBE_API_KEY\` değişkenini güncelleyin

4. Projeyi bir web sunucusunda çalıştırın:
   - Local development server kullanabilirsiniz
   - Live Server (VS Code extension) kullanabilirsiniz

## Kullanım

### Ana Sayfa
- Önerilen şarkılar
- Popüler çalma listeleri
- Favori şarkılarınız
- Arama çubuğu

### Arama
- Şarkı adı veya sanatçı adı ile arama yapın
- Gerçek zamanlı arama sonuçları
- Tıklayarak şarkıyı çalın

### Çalma Listeleri
- Yeni çalma listesi oluşturun
- Şarkıları çalma listelerine ekleyin
- Çalma listelerini düzenleyin
- Çalma listelerini silin

### Favoriler
- Şarkıları favorilere ekleyin
- Favori şarkılarınızı görüntüleyin
- Favorilerden şarkı çıkarın

## Performans Optimizasyonları

- Lazy loading images
- Debounced search
- Event delegation
- Efficient DOM manipulation
- Optimized animations
- Minimal dependencies

## Güvenlik

- API anahtarı güvenliği
- Content Security Policy
- HTTPS zorunluluğu
- Cross-Origin Resource Sharing (CORS)
- Input validation

## Katkıda Bulunma

1. Fork the Project
2. Create your Feature Branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit your Changes (\`git commit -m 'Add some AmazingFeature'\`)
4. Push to the Branch (\`git push origin feature/AmazingFeature\`)
5. Open a Pull Request

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Daha fazla bilgi için \`LICENSE\` dosyasına bakın.

## İletişim

Erkan Turgut - turguterkan1306@gmail.com

LinkedIn: [https://www.linkedin.com/in/erkanturgut1205](https://www.linkedin.com/in/erkanturgut1205)




---

Geliştirici: Erkan Turgut © 2024 