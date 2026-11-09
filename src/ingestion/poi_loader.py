"""
Ngarkuesi i pikave të interesit (POI) për Prishtinën.

Strategjia adaptive:
    1. Provo me 1 kërkesë të vetme (pa chunking)
    2. Nëse dështon, provo me 2×2 chunks
    3. Nëse dështon, provo me 3×3 chunks
    4. Nëse dështon, provo me 5×5 chunks
    5. Çdo chunk ruhet individualisht në cache
    6. Rifillim nga chunk-u i fundit nëse ndërpritet

Kjo shmang ngarkesën e panevojshme në Overpass API
për POI me pak objekte (si shkollat).
"""

import os
import time
import math
import osmnx as ox
import geopandas as gpd
import pandas as pd
from typing import Dict, List, Tuple
from pathlib import Path


# ==================== KONFIGURIMI ====================

OVERPASS_SERVERS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
]

ox.settings.overpass_url = OVERPASS_SERVERS[0]
ox.settings.timeout = 300
ox.settings.requests_timeout = 300
ox.settings.use_cache = True
ox.settings.log_console = False


POI_TAGS = {
    "hospitals": {"amenity": "hospital"},
    "clinics": {"amenity": "clinic"},
    "pharmacies": {"amenity": "pharmacy"},
    "schools": {"amenity": "school"},
    "universities": {"amenity": "university"},
    "kindergartens": {"amenity": "kindergarten"},
    "supermarkets": {"shop": "supermarket"},
    "restaurants": {"amenity": "restaurant"},
    "cafes": {"amenity": "cafe"},
    "banks": {"amenity": "bank"},
    "bus_stations": {"amenity": "bus_station"},
    "government": {"amenity": "townhall"},
}

PRIORITY_ORDER = [
    "hospitals", "clinics", "pharmacies",
    "schools", "universities", "supermarkets",
    "kindergartens", "restaurants", "cafes",
    "banks", "bus_stations", "government",
]


# ==================== HELPERS ====================

def format_time(seconds: float) -> str:
    """Formato sekonda në format njerëzor."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins}m {secs}s"


def print_progress_bar(
    current: int,
    total: int,
    prefix: str = "",
    suffix: str = "",
    length: int = 30,
    fill: str = "█",
) -> None:
    """Printo një progress bar në një rresht."""
    percent = current / total if total > 0 else 0
    filled = int(length * percent)
    bar = fill * filled + "░" * (length - filled)
    print(f"\r{prefix} |{bar}| {current}/{total} ({percent*100:.0f}%) {suffix}",
          end="", flush=True)


# ==================== GRID ====================

def make_grid(
    center: Tuple[float, float],
    dist: int,
    n_splits: int = 5,
) -> List[Tuple[float, float, float, str]]:
    """Ndaj zonën në n_splits × n_splits chunks."""
    lat_c, lon_c = center
    lat_offset = dist / 111000
    lon_offset = dist / (111000 * math.cos(math.radians(lat_c)))

    chunk_size_lat = (2 * lat_offset) / n_splits
    chunk_size_lon = (2 * lon_offset) / n_splits
    chunk_dist = int((dist / n_splits) * 1.4)

    chunks = []
    for i in range(n_splits):
        for j in range(n_splits):
            chunk_lat = lat_c - lat_offset + (i + 0.5) * chunk_size_lat
            chunk_lon = lon_c - lon_offset + (j + 0.5) * chunk_size_lon
            chunk_id = f"r{i}_c{j}"
            chunks.append((chunk_lat, chunk_lon, chunk_dist, chunk_id))

    return chunks


# ==================== FETCH ME RETRY ====================

def fetch_with_retry(
    center: Tuple[float, float],
    tags: dict,
    dist: int,
    max_retries: int = 3,
    base_delay: float = 3.0,
) -> gpd.GeoDataFrame:
    """Shkarko me retry dhe backoff progresiv."""
    last_error = None

    for attempt in range(max_retries):
        server = OVERPASS_SERVERS[attempt % len(OVERPASS_SERVERS)]
        ox.settings.overpass_url = server

        try:
            gdf = ox.features_from_point(center, tags=tags, dist=dist)
            return gdf
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                time.sleep(delay)

    raise last_error if last_error else Exception("Dështoi")


# ==================== CACHE PËR CHUNK ====================

def get_chunk_cache_path(cache_dir: str, poi_name: str, chunk_id: str) -> Path:
    return Path(cache_dir) / poi_name / f"{chunk_id}.gpkg"


def load_chunk_from_cache(cache_dir: str, poi_name: str, chunk_id: str):
    path = get_chunk_cache_path(cache_dir, poi_name, chunk_id)
    if path.exists():
        try:
            return gpd.read_file(path)
        except Exception:
            return None
    return None


def save_chunk_to_cache(
    cache_dir: str,
    poi_name: str,
    chunk_id: str,
    gdf: gpd.GeoDataFrame,
) -> None:
    path = get_chunk_cache_path(cache_dir, poi_name, chunk_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        gdf.to_file(path, driver="GPKG")
    except Exception:
        empty = gpd.GeoDataFrame(
            columns=["name", "geometry"],
            geometry="geometry",
            crs="EPSG:4326",
        )
        empty.to_file(path, driver="GPKG")


# ==================== FETCH POI ME CHUNKS ====================

def fetch_poi_chunked(
    poi_name: str,
    tags: dict,
    center: Tuple[float, float],
    dist: int,
    cache_dir: str,
    n_splits: int = 5,
    delay_between: float = 2.0,
    force_refresh: bool = False,
) -> gpd.GeoDataFrame:
    """Shkarko një POI duke e ndarë në chunks."""
    chunks = make_grid(center, dist, n_splits)
    total = len(chunks)
    all_gdfs = []
    cached_count = 0
    fetched_count = 0
    failed_count = 0

    start_time = time.time()

    for i, (clat, clon, cdist, cid) in enumerate(chunks, 1):
        cached = None if force_refresh else load_chunk_from_cache(cache_dir, poi_name, cid)

        if cached is not None:
            if not cached.empty:
                all_gdfs.append(cached)
            cached_count += 1
            print_progress_bar(
                i, total,
                prefix=f"  → {poi_name:18s}",
                suffix=f"[cache {cached_count}✓]",
            )
            continue

        try:
            gdf = fetch_with_retry((clat, clon), tags, cdist, max_retries=3)
            save_chunk_to_cache(cache_dir, poi_name, cid, gdf)
            if not gdf.empty:
                all_gdfs.append(gdf)
            fetched_count += 1
        except Exception:
            failed_count += 1
            empty = gpd.GeoDataFrame(
                columns=["name", "geometry"],
                geometry="geometry",
                crs="EPSG:4326",
            )
            save_chunk_to_cache(cache_dir, poi_name, cid, empty)

        print_progress_bar(
            i, total,
            prefix=f"  → {poi_name:18s}",
            suffix=f"[new {fetched_count}✓ ✗{failed_count}]",
        )

        if i < total:
            time.sleep(delay_between)

    print()

    if not all_gdfs:
        return gpd.GeoDataFrame()

    merged = pd.concat(all_gdfs, ignore_index=True)

    # Deduplication
    if "osmid" in merged.columns:
        merged = merged.drop_duplicates(subset="osmid", keep="first")
    elif "id" in merged.columns:
        merged = merged.drop_duplicates(subset="id", keep="first")
    else:
        merged["geometry_wkt"] = merged.geometry.apply(lambda g: g.wkt if g else "")
        merged = merged.drop_duplicates(subset="geometry_wkt", keep="first")
        merged = merged.drop(columns=["geometry_wkt"])

    merged = gpd.GeoDataFrame(merged, geometry="geometry", crs="EPSG:4326")

    elapsed = time.time() - start_time
    print(f"     └─ {len(merged)} objekte unike ({format_time(elapsed)})")

    return merged


# ==================== ADAPTIVE FETCH ====================

def fetch_poi_adaptive(
    poi_name: str,
    tags: dict,
    center: Tuple[float, float],
    dist: int,
    cache_dir: str,
    delay_between_chunks: float = 2.0,
    force_refresh: bool = False,
) -> gpd.GeoDataFrame:
    """
    Provo strategji të ndryshme derisa njëra të funksionojë:
        1. Single request (pa chunks)
        2. 2×2 chunks
        3. 3×3 chunks
        4. 5×5 chunks
    """
    strategies = [
        (1, "single request"),
        (2, "2×2 chunks"),
        (3, "3×3 chunks"),
        (5, "5×5 chunks"),
    ]

    last_error = None

    for n_splits, label in strategies:
        try:
            if n_splits == 1:
                print(f"  → {poi_name:18s} ({label})...", end=" ", flush=True)
                gdf = fetch_with_retry(center, tags, dist, max_retries=3)
                print(f"{len(gdf) if not gdf.empty else 0} objekte")
                return gdf
            else:
                print(f"  ⚠ {poi_name:18s} provo {label}...")
                gdf = fetch_poi_chunked(
                    poi_name, tags, center, dist,
                    cache_dir=cache_dir,
                    n_splits=n_splits,
                    delay_between=delay_between_chunks,
                    force_refresh=force_refresh,
                )
                return gdf
        except Exception as e:
            last_error = e
            print(f"     ✗ {label} dështoi: {str(e)[:60]}")
            continue

    raise last_error if last_error else Exception("Të gjitha strategjitë dështuan")


# ==================== MAIN FETCHER ====================

def fetch_prishtina_pois(
    center: tuple = (42.6629, 21.1655),
    dist: int = 5000,
    save_dir: str = "data/raw/osm",
    cache_dir: str = "data/cache/poi_chunks",
    skip_existing: bool = True,
    delay_between_chunks: float = 2.0,
    delay_between_pois: float = 3.0,
    priority_only: bool = False,
    force_refresh: bool = False,
) -> Dict[str, gpd.GeoDataFrame]:
    """
    Shkarkon POI-të e Prishtinës me strategji adaptive.
    """
    os.makedirs(save_dir, exist_ok=True)
    os.makedirs(cache_dir, exist_ok=True)
    results = {}

    pois_to_fetch = PRIORITY_ORDER if priority_only else list(POI_TAGS.keys())

    print(f"\n{'═'*70}")
    print(f"  POI LOADER — Prishtinë (Adaptive)")
    print(f"{'═'*70}")
    print(f"  Rrezja:      {dist}m")
    print(f"  POI:         {len(pois_to_fetch)}")
    print(f"  Cache dir:   {cache_dir}")
    print(f"  Skip cache:  {skip_existing}")
    print(f"  Force new:   {force_refresh}")
    print(f"{'═'*70}\n")

    start_time = time.time()

    for idx, name in enumerate(pois_to_fetch, 1):
        tags = POI_TAGS[name]
        output_path = os.path.join(save_dir, f"{name}.gpkg")

        # Kontrollo cache final
        if skip_existing and os.path.exists(output_path) and not force_refresh:
            try:
                gdf = gpd.read_file(output_path)
                results[name] = gdf
                print(f"  ✓ {name:18s} (cache final: {len(gdf):4d} objekte)")
                continue
            except Exception:
                pass

        print(f"\n[{idx}/{len(pois_to_fetch)}] {name.upper()}")

        try:
            gdf = fetch_poi_adaptive(
                name, tags, center, dist,
                cache_dir=cache_dir,
                delay_between_chunks=delay_between_chunks,
                force_refresh=force_refresh,
            )

            if gdf is None or gdf.empty:
                print(f"     ⚠ {name}: 0 objekte")
                empty = gpd.GeoDataFrame(
                    columns=["name", "geometry"],
                    geometry="geometry",
                    crs="EPSG:4326",
                )
                empty.to_file(output_path, driver="GPKG")
                results[name] = empty
            else:
                keep_cols = ["name", "geometry"]
                if "amenity" in gdf.columns:
                    keep_cols.append("amenity")
                if "shop" in gdf.columns:
                    keep_cols.append("shop")
                gdf = gdf[[c for c in keep_cols if c in gdf.columns]].copy()
                gdf.to_file(output_path, driver="GPKG")
                results[name] = gdf
                print(f"     ✓ {name}: {len(gdf)} objekte unike")

            if idx < len(pois_to_fetch):
                time.sleep(delay_between_pois)

        except Exception as e:
            print(f"\n     ✗ {name} DËSHTOI: {str(e)[:70]}")

    # Përmbledhje
    elapsed = time.time() - start_time
    print(f"\n{'═'*70}")
    print(f"  PËRMBLEDHJE FINALE")
    print(f"{'═'*70}")
    total = 0
    for name in pois_to_fetch:
        if name in results:
            count = len(results[name])
            total += count
            status = "✓" if count > 0 else "○"
            print(f"  {status} {name:20s}: {count:5d} objekte")
        else:
            print(f"  ✗ {name:20s}: DËSHTOI")
    print(f"{'─'*70}")
    print(f"  TOTAL: {total} objekte")
    print(f"  Koha totale: {format_time(elapsed)}")
    print(f"{'═'*70}\n")

    return results


def get_poi_coordinates(gdf: gpd.GeoDataFrame) -> list:
    """Kthen listë me (lat, lon) për çdo POI."""
    coords = []
    for _, row in gdf.iterrows():
        geom = row.geometry
        if geom is None:
            continue
        if geom.geom_type in ("Polygon", "MultiPolygon"):
            centroid = geom.centroid
            coords.append((centroid.y, centroid.x))
        elif geom.geom_type == "Point":
            coords.append((geom.y, geom.x))
    return coords


if __name__ == "__main__":
    pois = fetch_prishtina_pois(
        skip_existing=True,
        delay_between_chunks=2,
        delay_between_pois=3,
        force_refresh=False,
    )

    if "hospitals" in pois and not pois["hospitals"].empty:
        print("=== Spitalet e para ===")
        for i, (_, row) in enumerate(pois["hospitals"].iterrows()):
            if i >= 5:
                break
            name = row.get("name", "Pa emër")
            print(f"  {i+1}. {name}")