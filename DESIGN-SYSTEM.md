# Design System — Claire Vigneron CM

Référence complète pour créer de nouvelles pages cohérentes avec le site.

---

## Couleurs

| Nom | Hex | Usage |
|---|---|---|
| `cream` | `#F5F3EF` | Fond principal, texte sur dark |
| `cream-warm` | `#EBE8E0` | Fonds de sections secondaires, cartes |
| `cream-border` | `#D1CEC7` | Bordures, séparateurs, scrollbar |
| `ink` | `#1C1C1C` | Texte principal, fonds sombres (footer, hero dark) |
| `stone-900` | `#1a1a1a` | Titres, boutons primaires |
| `stone-600` | `#57534e` | Corps de texte, descriptions |
| `stone-500` | `#78716c` | Textes secondaires, sous-titres |
| `stone-400` | `#a8a29e` | Icônes déco, séparateurs légers |
| `stone-300` | `#d6d3d1` | Bordures légères, inputs |
| `stone-200` | `#e7e5e4` | Fonds hover très légers |

### Usage des couleurs par contexte

- **Fond de page** : `#F5F3EF`
- **Section alternée** : `#EBE8E0`
- **Section sombre** (footer, methodology) : `#1C1C1C`
- **Bouton primaire** : fond `#1C1C1C`, texte `#F5F3EF`
- **Bouton secondaire** : bordure `stone-300`, texte `stone-900`

---

## Typographie

### Polices

| Police | Famille | Usage |
|---|---|---|
| **DM Serif Display** | Serif | Tous les titres (h1–h6), classe `.serif` |
| **Manrope** | Sans-serif | Corps de texte, navigation, labels |

```html
<!-- Import Google Fonts (déjà dans BaseLayout.astro) -->
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Manrope:wght@300;400;500;600&display=swap" rel="stylesheet">
```

### Tailles de texte (échelle Tailwind)

| Classe | Usage |
|---|---|
| `text-9xl` | Hero H1 desktop (très grand impact) |
| `text-6xl / text-8xl` | Hero H1 mobile/tablette |
| `text-5xl / text-6xl` | H2 section (MissionStatement) |
| `text-4xl / text-5xl` | H3 section (Services, Portfolio) |
| `text-3xl` | H4 cartes |
| `text-2xl` | H5 articles journal |
| `text-xl` | Sous-titres hero, corps large |
| `text-lg` | Corps de texte standard |
| `text-sm` | Navigation, labels, liens |
| `text-xs` | Labels catégorie, badges uppercase |

### Styles typographiques courants

```html
<!-- Titre hero -->
<h1 class="text-6xl md:text-8xl lg:text-9xl font-serif leading-[0.9] tracking-tighter">

<!-- Titre de section -->
<h2 class="text-4xl md:text-6xl font-serif leading-tight tracking-tight">

<!-- Titre italique (accent) -->
<span class="italic font-light text-stone-500">mot clé</span>

<!-- Label badge uppercase -->
<span class="text-xs font-medium uppercase tracking-widest text-stone-500">

<!-- Corps de texte -->
<p class="text-lg text-stone-600 leading-relaxed font-light">
```

---

## Composants

### Bouton primaire (plein)

```html
<button class="px-8 py-4 bg-stone-900 text-[#F5F3EF] rounded-full hover:bg-stone-700 transition-colors duration-300 font-medium">
  Label
</button>
```

### Bouton secondaire (contour)

```html
<button class="px-8 py-4 border border-stone-300 text-stone-900 rounded-full hover:bg-stone-200 transition-all duration-300 font-medium">
  Label
</button>
```

### Bouton avec flèche animée

```html
<button class="group px-8 py-4 bg-stone-900 text-[#F5F3EF] rounded-full font-medium">
  <span class="flex items-center gap-2">
    Label
    <iconify-icon icon="solar:arrow-right-linear" class="group-hover:translate-x-1 transition-transform"></iconify-icon>
  </span>
</button>
```

### Carte service

```html
<div class="group bg-[#EBE8E0] p-8 md:p-10 rounded-2xl hover:bg-[#E5E1D8] transition-colors duration-300 cursor-pointer flex flex-col h-full">
  <div class="w-12 h-12 bg-stone-900 text-[#F5F3EF] rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shrink-0">
    <iconify-icon icon="solar:target-linear" stroke-width="1.5" class="text-2xl"></iconify-icon>
  </div>
  <h4 class="text-3xl text-stone-900 mb-4 tracking-tight">Titre</h4>
  <p class="text-stone-600 mb-8 leading-relaxed flex-grow">Description</p>
  <span class="inline-flex items-center text-sm font-semibold uppercase tracking-wider text-stone-900 mt-auto">
    Learn More <iconify-icon icon="solar:arrow-right-up-linear" class="ml-1"></iconify-icon>
  </span>
</div>
```

### Badge label (pill)

```html
<span class="inline-block py-1 px-3 border border-stone-300 rounded-full text-xs font-medium uppercase tracking-widest text-stone-500 bg-white/30 backdrop-blur-sm">
  Label
</span>
```

---

## Espacement

| Usage | Classe Tailwind |
|---|---|
| Padding de section (vertical) | `py-20` / `py-24` |
| Padding de section (horizontal) | `px-6 md:px-12` |
| Largeur max contenu | `max-w-7xl mx-auto` |
| Largeur max texte centré | `max-w-4xl mx-auto` |
| Gap entre cartes | `gap-8` |
| Espacement interne cartes | `p-8 md:p-10` |

---

## Icônes

Bibliothèque : **Solar Icons** via Iconify

```html
<!-- Usage (web component, chargé via CDN dans BaseLayout) -->
<iconify-icon icon="solar:NOM-linear" stroke-width="1.5" class="text-2xl"></iconify-icon>
```

Icônes utilisées dans le site :

| Icône | Contexte |
|---|---|
| `solar:hamburger-menu-linear` | Menu mobile |
| `solar:user-circle-linear` | Profil mobile |
| `solar:arrow-right-linear` | CTA avec flèche |
| `solar:arrow-right-up-linear` | "Learn more" cartes |
| `solar:diamond-linear` | Déco section mission |
| `solar:shield-check-linear` | Déco section quote |
| `solar:check-circle-linear` | Liste de points |
| `solar:camera-linear` | Lien Instagram footer |
| `solar:letter-linear` | Lien email footer |
| `solar:target-linear` | Service Brand Strategy |
| `solar:monitor-camera-linear` | Service Website |
| `solar:clapperboard-play-linear` | Service Content |
| `solar:videocamera-linear` | Service Video |
| `solar:rocket-linear` | Service Launch |
| `solar:refresh-circle-linear` | Service Retainer |

Catalogue complet : [icon-sets.iconify.design/solar](https://icon-sets.iconify.design/solar/)

---

## Animations

### Marquee (défilement horizontal infini)

```css
.marquee-container {
  mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
}
@keyframes scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.animate-scroll {
  animation: scroll 30s linear infinite;
}
```

Règle : **toujours doubler** le contenu (tableau × 2) pour que la boucle soit invisible.

### Transitions standard

| Effet | Classe |
|---|---|
| Couleur au hover | `transition-colors duration-300` |
| Toutes propriétés | `transition-all duration-300` |
| Transform (scale) | `transition-transform` |
| Opacité | `transition-opacity` |

---

## Layout & Grille

### Page entière

```astro
<BaseLayout title="Ma Page">
  <Banner />
  <Nav />
  <!-- sections -->
  <Footer />
</BaseLayout>
```

### Grille 3 colonnes (cartes, articles)

```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
```

### 2 colonnes (image + texte)

```html
<div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
```

### Section fond sombre

```html
<section class="py-20 px-6 md:px-12 bg-[#1C1C1C] text-[#F5F3EF] rounded-t-[3rem]">
```

---

## Comment créer une nouvelle page

1. Crée `src/pages/ma-page.astro`
2. Importe `BaseLayout` et les composants nécessaires
3. Pour une nouvelle section, crée `src/components/MaSection.astro`
4. Consulte ce fichier pour les couleurs, tailles, et classes exactes
