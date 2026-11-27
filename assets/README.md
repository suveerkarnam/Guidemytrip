# Image assets

Phase 2 uses remote Unsplash image URLs in `config/destinations.json` and the guide demo data so the repository stays lightweight while the design is evaluated. `ImageWithFallback` provides a branded, non-broken fallback if an image host is unavailable. Before production, download and license approved image files into `assets/destinations/`, `assets/guides/`, and `assets/packages/`, then update the configuration URLs.
