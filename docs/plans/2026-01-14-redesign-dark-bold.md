# GymBo Website Redesign: Dark & Bold

## Zielsetzung

Die Website soll moderner und eleganter wirken - weg vom generischen Landing-Page-Look, hin zu einem Premium-Tech-Feeling wie linear.app oder raycast.com.

**Kernänderungen:**
- Dark-First Design mit warmem Amber/Gold-Akzent
- Floating Devices mit Parallax-Tiefe
- Subtil-smooth Animationen (elegant, nicht aufdringlich)
- Asymmetrische Feature-Präsentation statt Bento-Grid

---

## 1. Visuelle Grundlage

### Farbschema

| Rolle | Farbe | Hex |
|-------|-------|-----|
| Hintergrund | Tiefes Schwarz | `#0A0A0A` |
| Hintergrund (Surface) | Dunkelgrau | `#141414` |
| Primär (Amber) | Warmes Gold | `#F59E0B` |
| Primär (Hover) | Helles Gold | `#FBBF24` |
| Sekundär | Gedämpftes Orange | `#EA580C` |
| Text (Headlines) | Reines Weiß | `#FFFFFF` |
| Text (Body) | Grau | `#A3A3A3` |
| Text (Muted) | Dunkelgrau | `#737373` |

### Typografie

- **Font-Familie:** Inter oder Satoshi (geometrisch, modern)
- **Headlines:** Weight 800, letter-spacing: -0.04em, eng gesetzt
- **Body:** Weight 400, letter-spacing: normal, 1.6 line-height
- **Größen:**
  - Hero H1: clamp(4rem, 8vw, 7rem)
  - Section H2: clamp(2.5rem, 5vw, 4rem)
  - Feature H3: 1.5rem - 2rem
  - Body: 1rem - 1.125rem

### Hintergrund-Treatment

- Kein flaches Schwarz
- Subtiler radialer Gradient von oben (Amber, 5-10% Opacity)
- Noise/Grain-Overlay (PNG, 2-3% Opacity) für fotografische Textur
- Optional: Sehr dezente Grid-Lines (5% Opacity)

---

## 2. Hero-Bereich

### Layout

```
┌─────────────────────────────────────────────┐
│  Logo                    Nav    [App Store] │  <- Kompakter Header
│                                             │
│                                             │
│              Training.                      │
│           Ohne Bullshit.                    │  <- "Ohne Bullshit" in Amber
│                                             │
│      Subline in Grau, kurz gefasst          │
│                                             │
│        [App Store]    [Screenshots]         │  <- CTAs
│                                             │
│           ┌───────┐                         │
│      ┌────┤       ├────┐                    │  <- Floating Devices
│      │    │   █   │    │                    │
│      │    │   █   │    │                    │
└──────┴────┴───────┴────┴────────────────────┘
```

### Floating Devices Komposition

- **3 iPhones** in gestaffelter Anordnung
- **Mittleres Device:** Frontal, größer, leicht nach vorne geneigt
  - `transform: perspective(1000px) rotateX(5deg)`
  - z-index: 3
- **Linkes Device:** 15° nach links rotiert, kleiner, weiter hinten
  - `transform: perspective(1000px) rotateY(15deg) translateX(-20%) scale(0.85)`
  - z-index: 2
- **Rechtes Device:** 15° nach rechts rotiert, kleiner, weiter hinten
  - `transform: perspective(1000px) rotateY(-15deg) translateX(20%) scale(0.85)`
  - z-index: 2
- Alle schweben über den unteren Viewport-Rand hinaus
- Subtiler Amber-tinted Glow/Schatten unter jedem Device

### Parallax beim Scrollen

- Mittleres Device: `translateY` mit Faktor 0.3 (langsam)
- Seitliche Devices: `translateY` mit Faktor 0.6 (schneller)
- Erzeugt natürliche Tiefenstaffelung

---

## 3. Feature-Präsentation

### Struktur

Weg vom gleichförmigen Bento-Grid. Stattdessen:

1. **Hervorgehobene Features** (volle Breite, viel Raum)
2. **Sekundäre Features** (kompakte Reihen)

### Hervorgehobene Features (3 Stück)

Jedes bekommt einen eigenen "Moment":

#### A) Intelligente Progression
- Links: Text (Icon, Headline, Beschreibung)
- Rechts: Animierte Grafik (Gewichtskurve steigt)
- Amber-Akzent auf der Kurve

#### B) Apple Watch App
- Rechts: Text
- Links: Floating Watch + iPhone nebeneinander
- Watch zeigt Workout-Screen, iPhone zeigt Companion-View
- Badge: "Bald verfügbar" in gedämpftem Stil

#### C) 100% Offline & Privat
- Zentriert, ikonische Darstellung
- Großes Shield/Lock-Icon mit Amber-Glow
- Text darunter
- Privacy-Icons in einer Reihe (Wifi-Slash, Eye-Slash, Lock)

### Sekundäre Features

2-3 pro Reihe, Card-Style:

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│     Icon     │  │     Icon     │  │     Icon     │
│    Titel     │  │    Titel     │  │    Titel     │
│   1-Zeiler   │  │   1-Zeiler   │  │   1-Zeiler   │
└──────────────┘  └──────────────┘  └──────────────┘
```

- Dezenter Border (`#FFFFFF` 10% Opacity)
- Hover: Leicht anheben, Amber-Glow am Border
- Features: Supersätze, Links/Rechts-Tracking, Export, Trainings splitten, Challenges, Achievements, Star-Workouts, Import (Hevy/Strong)

### Stats-Element

- "217+ Übungen" als große animierte Zahl
- Zählt hoch beim Einblenden (0 → 217)
- Amber-Gradient auf der Zahl

### Scroll-Animationen

```css
.feature-reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.feature-reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

- Staggered: Elemente erscheinen 100ms zeitversetzt
- Trigger: IntersectionObserver bei 20% Sichtbarkeit

---

## 4. CTA-Sektionen

### Testflight/Early Access

```
┌─────────────────────────────────────────────┐
│                                             │
│         Version 3.0 Early Access            │  <- Große Headline
│       Testflight-Plätze limitiert           │  <- Subline in Grau
│                                             │
│    [        deine@email.com        ] [Amber]│  <- Inline Input + Button
│                                             │
└─────────────────────────────────────────────┘
```

- Kein umrandeter Container
- Input: Dunkler Hintergrund (#141414), heller Border
- Button: Amber, rechts angedockt

### Finaler CTA

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│                  Bereit?                    │  <- Riesige Headline
│                                             │
│           6,99 € — einmalig, für immer      │  <- Preis elegant
│                                             │
│              [  App Store  ]                │  <- Amber-Button
│                                             │
│    Kein Abo. Keine Tracker. Deine Daten.    │  <- Trust-Indicators
│                                             │
└─────────────────────────────────────────────┘
```

---

## 5. Footer

### Layout

```
┌─────────────────────────────────────────────┐
│─────────────────────────────────────────────│  <- 1px Linie, 10% Opacity
│                                             │
│  GymBo     Impressum · Datenschutz · Manifest     │
│                                             │
│              © 2025 Ben Kohler              │
│                                             │
└─────────────────────────────────────────────┘
```

- Minimal, eine Zeile für Links
- Kein aufgeblähtes Spalten-Layout
- Kompakte Höhe

---

## 6. Header/Navigation

### Desktop

```
┌─────────────────────────────────────────────┐
│  GymBo        Features  FAQ  Roadmap   [AS] │
└─────────────────────────────────────────────┘
```

- Fixed, Backdrop-Blur auf Schwarz
- Logo: "Gym" bold, "Bo" in Amber
- Links: Wenige, nur die wichtigsten
- App Store Button: Kompakt, Amber-Outline oder filled

### Mobile

- Hamburger-Menu
- Fullscreen-Overlay beim Öffnen
- Links vertikal, groß

---

## 7. Technische Umsetzung

### CSS Custom Properties

```css
:root {
  --bg-base: #0A0A0A;
  --bg-surface: #141414;
  --bg-elevated: #1F1F1F;

  --amber-500: #F59E0B;
  --amber-400: #FBBF24;
  --amber-600: #D97706;
  --orange-600: #EA580C;

  --text-primary: #FFFFFF;
  --text-secondary: #A3A3A3;
  --text-muted: #737373;

  --border-subtle: rgba(255, 255, 255, 0.1);
  --border-default: rgba(255, 255, 255, 0.15);

  --glow-amber: rgba(245, 158, 11, 0.4);
}
```

### Parallax Implementation

```javascript
// Smooth parallax mit requestAnimationFrame
const devices = document.querySelectorAll('.hero-device');
const speeds = [0.3, 0.6, 0.6]; // Mitte, Links, Rechts

window.addEventListener('scroll', () => {
  requestAnimationFrame(() => {
    const scrollY = window.scrollY;
    devices.forEach((device, i) => {
      device.style.transform = `translateY(${scrollY * speeds[i]}px)`;
    });
  });
});
```

### Scroll-Reveal

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, index) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, index * 100); // Stagger
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.2 });

document.querySelectorAll('.feature-reveal').forEach(el => observer.observe(el));
```

### Grain-Overlay

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url('/assets/noise.png');
  opacity: 0.03;
  pointer-events: none;
  z-index: 1000;
}
```

---

## 8. Assets benötigt

- [ ] iPhone Mockups (3x, verschiedene Winkel) - transparent PNG
- [ ] Apple Watch Mockup - transparent PNG
- [ ] Neue Screenshots in der App (Dark Mode bevorzugt)
- [ ] Noise/Grain Texture (PNG, tileable)
- [ ] Icons: Phosphor Icons beibehalten (funktioniert gut)

---

## 9. Light Mode

Vorerst **nicht priorisieren**. Dark ist der Standard. Falls später gewünscht:

- Hintergrund: Warm-Weiß (#FAFAF9)
- Amber bleibt als Akzent
- Text invertieren

---

## Zusammenfassung

| Element | Aktuell | Neu |
|---------|---------|-----|
| Hintergrund | Hell (#fafafa) | Dunkel (#0A0A0A) |
| Akzentfarbe | Lime-Grün | Amber/Gold |
| Hero | Zentrierter Text + Carousel | Floating Devices mit Parallax |
| Features | Bento-Grid | Asymmetrische Sektionen |
| Animationen | Fade-Up | Subtile Parallax + Staggered Reveals |
| Feeling | Generische Landing-Page | Premium Tech / Fitness Power |
