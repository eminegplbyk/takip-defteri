<div align="center">

# 📒 Takip Defteri

**Instagram'da seni kimin takipten çıktığını, şifreni vermeden ve uygulama indirmeden gör.**

[![Canlı Demo](https://img.shields.io/badge/Canl%C4%B1_Demo-GitHub_Pages-5b3fd6?style=for-the-badge&logo=github)](https://eminegplbyk.github.io/takip-defteri/)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Framework yok](https://img.shields.io/badge/framework-yok-lightgrey?style=flat-square)
![Testler](https://img.shields.io/badge/testler-node%20--test-339933?style=flat-square&logo=node.js&logoColor=white)
![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue?style=flat-square)

<img src="docs/ekran-goruntusu.png" alt="Takip Defteri ana ekranı" width="720">

</div>

---

## 💡 Bu proje nasıl doğdu?

Instagram'da beni kimin takipten çıktığını görmek istiyordum, ama bunun için önüme çıkan yollar hoşuma gitmedi:

- Takipçi uygulamalarının neredeyse hepsi **Instagram şifremi** istiyordu. Bu hem hesabımı riske atmak hem de Instagram kurallarına aykırı bir şey yapmak demekti.
- Telefonuma reklam dolu, ne yaptığı belli olmayan **bir uygulama daha indirmek** istemiyordum.
- Takipçi listemi elle tek tek karşılaştırmak ise 300'den fazla hesapla imkânsızdı.

Sonra Instagram'ın herkese sunduğu **"Bilgilerini indir"** özelliğini fark ettim: takipçi ve takip edilen listelerini JSON olarak veriyor. Geriye bu dosyaları okuyup karşılaştıracak bir araç kalıyordu. Ben de **tarayıcıda çalışan, hiçbir yere veri göndermeyen** bu küçük uygulamayı yazdım.

Kendi verimle denerken bir sorun daha çıktı: listede "seni takip etmiyor" görünen bazı hesaplar aslında **dondurulmuş** hesaplardı. Instagram'ın dosyası bu ikisini ayırmıyor. Yanıltıcı sonuç vermemek için takipten çıkanları durumlarına göre etiketleyen bir yapı ve "Hesap kapalı" işaretleme özelliği ekledim.

## ✨ Özellikler

| | |
|---|---|
| 🔒 **Gizlilik önce** | Şifre istemez, sunucu yok. Dosyalar sadece tarayıcında işlenir. |
| 📦 **ZIP'i doğrudan okur** | Instagram'dan inen ZIP'i açmana gerek yok. |
| 📉 **Takipten çıkanlar** | İki indirme arasında kimin gittiğini gösterir. |
| 🙈 **Geri takip etmeyenler** | Senin takip ettiğin ama seni takip etmeyenler. |
| 🧊 **Dondurulmuş hesapları ayırma** | Profilini kontrol ettiğin hesabı "Hesap kapalı" diye işaretlersin, listeden çıkar ve hatırlanır. |
| 🏷️ **Durum etiketleri** | *Çıktı ya da hesabı kapalı*, *Senin listenden de düştü*, *Belirsiz*, *Geri döndü* |
| ✏️ **Ad değişikliği tespiti** | Instagram takip tarihini ad değişse de korur. Aynı tarihle giden ve gelen hesap aynı kişi sayılır. |
| ⭐ **Muaf tut** | Ünlüleri ve markaları listeden gizler. |
| 📈 **Grafik ve günlük** | Takipçi sayının değişimi ve tüm kayıtlar boyunca kim geldi, kim gitti. |
| 🔍 **Arama, sıralama, dışa aktarma** | `/` ile arama, A–Z ya da tarihe göre sıralama, panoya kopyalama, CSV |
| 💾 **Yedek** | Geçmişini JSON olarak indirip başka bir cihazda geri yükleyebilirsin. |
| 🌗 **Açık / koyu tema** | Mobil uyumlu tasarım |

## 🚀 Nasıl kullanılır?

**1. Verini Instagram'dan indir**

> **Ayarlar ve hareketler → Hesaplar Merkezi → Bilgilerin ve izinlerin → Bilgilerini indir → Bilgileri indir veya aktar → Bilgilerinin bir kısmı → Takipçiler ve takip edilenler**
>
> **Cihaza indir** seçeneğini seç. Tarih aralığı **Tüm zamanlar**, format **JSON** olsun.

<details>
<summary>Instagram'ın İngilizce arayüzü için</summary>

> **Accounts Center → Your information and permissions → Download your information → Download or transfer information → Some of your information → Followers and following → Download to device** (Date range: *All time*, Format: *JSON*)

</details>

**2. Siteyi aç:** [eminegplbyk.github.io/takip-defteri](https://eminegplbyk.github.io/takip-defteri/) adresine git ya da `index.html`'i tarayıcıda aç.

**3. ZIP'i sayfaya sürükle.** İlk yüklemede seni geri takip etmeyenleri görürsün.

**4. Bir hafta sonra tekrar indirip yükle.** Bu sefer kimin takipten çıktığını da görürsün.

> 🧪 **Hemen denemek istersen:** önce `sample-data/hafta-1`, sonra `sample-data/hafta-2` klasöründeki iki JSON'u yükle. Örnekte bir takipten çıkma, bir hesap kapatma, bir ad değişikliği ve bir yeni takipçi var.

## 🧭 Sonuçları nasıl okumalı?

Instagram'ın verdiği dosyada bir hesabın **dondurulmuş mu yoksa açık mı** olduğu yazmıyor. Dondurulmuş hesaplar takip listende kalmaya devam edebiliyor ama takipçilerin arasında görünmüyor. Bu yüzden sonuçları etiketlerle gösteriyorum:

| Etiket | Anlamı |
|---|---|
| 🔴 **Çıktı ya da hesabı kapalı** | Seni takip etmeyi bırakmış ama hâlâ senin takip listende. Takipten çıkmış ya da hesabını dondurmuş. |
| 🟠 **Senin listenden de düştü** | İki listeden de gitmiş. Hesabını silmiş, seni engellemiş ya da sen takipten çıkmış olabilirsin. |
| ⚪ **Belirsiz** | Sen takip etmiyordun, o yüzden sebebi bilinemiyor. |
| 🟢 **Geri döndü** | Daha önce de takip ediyordu, bir süre kayboldu ve geri geldi. Genelde hesabını dondurup açanlar. |
| ✏️ **Ad değiştirdi** | Aynı takip tarihine sahip hesap başka bir adla geri gelmiş. |
| 🧊 **Hesap kapalı** | Profiline bakıp senin işaretlediğin hesap. Takipten çıkmış sayılmaz. |

## 🗂️ Proje yapısı

```
takip-defteri/
├── index.html               # Sayfa iskeleti
├── assets/
│   ├── css/
│   │   └── style.css        # Tema değişkenleri, açık/koyu mod, mobil düzen
│   └── js/
│       ├── parser.js        # Instagram JSON okuma, karşılaştırma, ad değişikliği tespiti
│       ├── store.js         # localStorage: kayıt geçmişi, işaretler, tema, yedek
│       └── app.js           # Arayüz: sekmeler, SVG grafik, arama, sıralama, dışa aktarma
├── sample-data/             # Instagram formatında örnek veriler
│   ├── hafta-1/
│   └── hafta-2/
├── tests/
│   └── parser.test.js       # Karşılaştırma mantığının birim testleri
├── docs/                    # README görselleri
├── package.json
├── LICENSE
└── README.md
```

**Mimari kararlar**

- **Derleme adımı ve framework yok.** Düz HTML, CSS ve JavaScript kullandım; `index.html`'e çift tıklamak yeterli.
- **İş mantığı arayüzden ayrı.** `parser.js` DOM'a hiç dokunmuyor. Hem tarayıcıda hem Node'da çalıştığı için test edilebiliyor.
- **Tek dış bağımlılık** ZIP okumak için kullanılan [JSZip](https://stuk.github.io/jszip/). CDN'den yükleniyor.
- **Grafik saf SVG ile çiziliyor**, grafik kütüphanesi yok.

## 🧪 Testler

```bash
npm test
```

Testler örnek veriler üzerinden şunları doğruluyor:

- İki dosya türünün de tanınması (Instagram 2025 sonrası `following.json` formatı dahil)
- Geri takip etmeyenlerin ve karşılıklı takiplerin doğru hesaplanması
- Takipten çıkan, iki listeden de düşen ve ad değiştiren hesapların birbirinden ayrılması
- HTML formatında indirilmiş dosyanın fark edilip kullanıcının uyarılması

## 🔐 Gizlilik

- Dosyaların sadece tarayıcında işlenir, **hiçbir sunucuya veri gönderilmez**.
- Kayıtlar tarayıcının `localStorage` alanında durur. Tarayıcı verisini silersen geçmiş de gider, o yüzden ara sıra **Yedeği indir**'i kullan.
- Kendi Instagram verini repoya yükleme. `.gitignore` buna karşı kısmen koruma sağlıyor.

## ⚠️ Sınırlar

- Sonuçlar anlık değil, iki veri indirme arasındaki farkı gösteriyor.
- Bir hesabın dondurulup dondurulmadığı dosyadan anlaşılamıyor. Kesin bilgi için profile bakıp işaretlemek gerekiyor.

## 🛣️ Yol haritası

- [ ] Birden çok Instagram hesabı desteği
- [ ] İngilizce arayüz
- [ ] Takipten çıkanlar için tarih aralığı filtresi

## 👩‍💻 Geliştirici

**Emine Gül Palabıyık**
Gazi Üniversitesi, Yönetim Bilişim Sistemleri

[![LinkedIn](https://img.shields.io/badge/LinkedIn-eminegulpalabiyik-0A66C2?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/eminegulpalabiyik)
[![GitHub](https://img.shields.io/badge/GitHub-eminegplbyk-181717?style=flat-square&logo=github)](https://github.com/eminegplbyk)

---

<sub>MIT lisansı ile dağıtılır. Bu proje Instagram ya da Meta ile bağlantılı değildir.</sub>
