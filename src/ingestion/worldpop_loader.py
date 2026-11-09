# src/ingestion/worldpop_loader.py
import rasterio
import numpy as np

def load_population_density():
    """
    Lexon rasterin e WorldPop për Kosovën.
    Shkarko manualisht nga: https://hub.worldpop.org/geodata/summary?id=xxx
    Skedari: kos_ppp_2025_UNadj.tif (100m resolution)
    """
    with rasterio.open("data/raw/worldpop/kos_ppp_2025_UNadj.tif") as src:
        # Lexo vetëm zonën e Prishtinës
        # Koordinatat e bounding box për Prishtinë
        window = rasterio.windows.from_bounds(
            left=21.0, bottom=42.5, right=21.3, top=42.8,
            transform=src.transform
        )
        data = src.read(1, window=window)
        transform = src.window_transform(window)
        
        # Krijo GeoDataFrame me qelizat që kanë popullsi > 0
        rows, cols = np.where(data > 0)
        populations = data[rows, cols]
        
        # Konverto në koordinata gjeografike
        xs, ys = rasterio.transform.xy(transform, rows, cols)
        
        print(f"Qeliza me popullsi: {len(populations)}")
        print(f"Popullsia totale: {populations.sum():.0f}")
        
        return {
            'x': np.array(xs),
            'y': np.array(ys),
            'pop': populations,
            'transform': transform
        }