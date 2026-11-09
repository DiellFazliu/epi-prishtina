"""
Routing mbi rrjetin real të Prishtinës.

Përdoret për:
    - Gjetjen e rrugës më të shkurtër për ambulancat
    - Kalkulimin e kohës së reagimit
    - Ridrejtimin dinamik në kohë reale
"""

import os
import math
import networkx as nx
import osmnx as ox
from typing import List, Tuple, Optional, Dict
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════
# KONFIGURIMI
# ═══════════════════════════════════════════════════════════════════

GRAPH_PATH = "data/raw/osm/prishtina_network.graphml"

# Shpejtësitë mesatare (km/h)
SPEED_LIMITS = {
    "motorway": 100,
    "trunk": 80,
    "primary": 60,
    "secondary": 50,
    "tertiary": 40,
    "residential": 30,
    "service": 20,
    "living_street": 15,
}


# ═══════════════════════════════════════════════════════════════════
# ROUTER KLASA
# ═══════════════════════════════════════════════════════════════════

class AmbulanceRouter:
    """
    Gjen rrugën më të shkurtër midis dy pikave në Prishtinë.
    
    Përdor:
        - A* për gjetje të shpejtë
        - Dijkstra si fallback
        - Cache për nyje
    
    Shembull:
        router = AmbulanceRouter()
        result = router.find_shortest_path(
            from_lat=42.6629, from_lon=21.1655,
            to_lat=42.6467, to_lon=21.1653,
        )
        print(f"Koha: {result['time_seconds']}s")
        print(f"Distanca: {result['distance_m']}m")
    """
    
    _instance = None
    
    def __new__(cls, *args, **kwargs):
        """Singleton — lexo grafikun vetëm njëherë."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self, graph_path: str = GRAPH_PATH):
        # Nëse është inicializuar tashmë, mos e ri-bëj
        if hasattr(self, "_initialized"):
            return
        self._initialized = True
        
        if not os.path.exists(graph_path):
            raise FileNotFoundError(
                f"Rrjeti rrugor nuk u gjet: {graph_path}\n"
                f"Ekzekuto: python src/ingestion/osm_loader.py"
            )
        
        print(f"Duke ngarkuar rrjetin rrugor...")
        self.G = ox.load_graphml(graph_path)
        
        # Statistikat
        print(f"[OK] Nyje: {self.G.number_of_nodes():,}")
        print(f"[OK] Brinjë: {self.G.number_of_edges():,}")
        
        # Cache për nyjet e afërta
        self._node_cache: Dict[Tuple[float, float], int] = {}
    
    # ═══════════════════════════════════════════════════════════════
    # NYJET
    # ═══════════════════════════════════════════════════════════════
    
    def find_nearest_node(self, lat: float, lon: float) -> int:
        """Gjen nyjen më të afërt me koordinatat."""
        # Kontrollo cache-in
        key = (round(lat, 4), round(lon, 4))
        if key in self._node_cache:
            return self._node_cache[key]
        
        node = ox.distance.nearest_nodes(self.G, lon, lat)
        self._node_cache[key] = node
        return node
    
    # ═══════════════════════════════════════════════════════════════
    # RRUGËT
    # ═══════════════════════════════════════════════════════════════
    
    def find_shortest_path(
        self,
        from_lat: float,
        from_lon: float,
        to_lat: float,
        to_lon: float,
        algorithm: str = "astar",
        weight: str = "travel_time",
    ) -> dict:
        """
        Gjen rrugën më të shkurtër midis dy pikave.
        
        Args:
            from_lat, from_lon: Pika e nisjes
            to_lat, to_lon: Pika e destinacionit
            algorithm: "astar" ose "dijkstra"
            weight: "travel_time" (default) ose "length"
        
        Returns:
            {
                "path": [node_ids],
                "distance_m": float,
                "time_seconds": float,
                "coordinates": [(lat, lon), ...],
                "algorithm": str,
            }
        """
        start = self.find_nearest_node(from_lat, from_lon)
        end = self.find_nearest_node(to_lat, to_lon)
        
        if start == end:
            return {
                "path": [start],
                "distance_m": 0,
                "time_seconds": 0,
                "coordinates": [(from_lat, from_lon)],
                "algorithm": algorithm,
            }
        
        try:
            if algorithm == "astar":
                path = nx.astar_path(
                    self.G,
                    start,
                    end,
                    heuristic=self._haversine_heuristic,
                    weight=weight,
                )
            else:
                path = nx.shortest_path(
                    self.G,
                    start,
                    end,
                    weight=weight,
                )
        except nx.NetworkXNoPath:
            return {
                "path": [],
                "distance_m": 0,
                "time_seconds": 0,
                "coordinates": [],
                "algorithm": algorithm,
                "error": "Nuk ka rrugë midis pikave",
            }
        
        # Llogarit metrikat
        distance = 0
        travel_time = 0
        
        for u, v in zip(path[:-1], path[1:]):
            edge_data = self.G[u][v][0]  # MultiDiGraph — merr edge të parë
            distance += edge_data.get("length", 0)
            travel_time += edge_data.get("travel_time", 0)
        
        coordinates = [
            (self.G.nodes[n]["y"], self.G.nodes[n]["x"])
            for n in path
        ]
        
        return {
            "path": path,
            "distance_m": round(distance, 1),
            "time_seconds": round(travel_time, 1),
            "coordinates": coordinates,
            "algorithm": algorithm,
        }
    
    def _haversine_heuristic(self, u: int, v: int) -> float:
        """
        Heuristic për A* — distanca haversine në km/h.
        
        Kjo është e pranueshme sepse nuk e mbivlerëson
        kohën reale të udhëtimit.
        """
        lat1, lon1 = self.G.nodes[u]["y"], self.G.nodes[u]["x"]
        lat2, lon2 = self.G.nodes[v]["y"], self.G.nodes[v]["x"]
        
        # Distanca haversine
        R = 6371.0  # Rrezja e Tokës në km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        
        a = (
            math.sin(dlat / 2) ** 2 +
            math.cos(lat1_rad) * math.cos(lat2_rad) *
            math.sin(dlon / 2) ** 2
        )
        c = 2 * math.asin(math.sqrt(a))
        
        # Konverto në sekonda me shpejtësi 50 km/h (heuristika është gjithmonë më e vogël)
        distance_km = R * c
        time_hours = distance_km / 50
        return time_hours * 3600
    
    # ═══════════════════════════════════════════════════════════════
    # BATCH OPERATIONS
    # ═══════════════════════════════════════════════════════════════
    
    def find_multiple_paths(
        self,
        from_location: Tuple[float, float],
        destinations: List[Tuple[float, float, str]],
        algorithm: str = "astar",
    ) -> List[dict]:
        """
        Gjen rrugët nga një burim në shumë destinacione.
        """
        results = []
        
        for lat, lon, label in destinations:
            result = self.find_shortest_path(
                from_location[0],
                from_location[1],
                lat,
                lon,
                algorithm=algorithm,
            )
            result["destination_label"] = label
            result["destination_coords"] = (lat, lon)
            results.append(result)
        
        # Rendit sipas kohës
        return sorted(results, key=lambda r: r["time_seconds"])
    
    # ═══════════════════════════════════════════════════════════════
    # ISOCHRONES
    # ═══════════════════════════════════════════════════════════════
    
    def get_reachable_area(
        self,
        center_lat: float,
        center_lon: float,
        max_time_seconds: float = 600,
    ) -> List[Tuple[float, float]]:
        """
        Kthen zonën e arritshme brenda një kohe të caktuar.
        
        Përdoret për të treguar se deri ku mund të arrijë ambulanca
        në X sekonda.
        """
        start = self.find_nearest_node(center_lat, center_lon)
        
        # Dijkstra me kohë të kufizuar
        lengths = nx.single_source_dijkstra_path_length(
            self.G,
            start,
            cutoff=max_time_seconds,
            weight="travel_time",
        )
        
        # Kthe koordinatat
        return [
            (self.G.nodes[n]["y"], self.G.nodes[n]["x"])
            for n in lengths.keys()
        ]


# ═══════════════════════════════════════════════════════════════════
# TEST
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    router = AmbulanceRouter()
    
    # Test: Nga QKUK në Qendër
    result = router.find_shortest_path(
        from_lat=42.6467, from_lon=21.1653,  # QKUK
        to_lat=42.6629, to_lon=21.1655,      # Qendra
    )
    
    print(f"\n=== Test Routing ===")
    print(f"Nga: QKUK")
    print(f"Deri: Qendra")
    print(f"Algoritmi: {result['algorithm']}")
    print(f"Distanca: {result['distance_m'] / 1000:.2f} km")
    print(f"Koha: {result['time_seconds'] / 60:.2f} min")
    print(f"Nyje: {len(result['path'])}")
    
    # Test: Isochrone
    print(f"\n=== Zona e arritshme ===")
    area = router.get_reachable_area(42.6629, 21.1655, max_time_seconds=300)
    print(f"Pika të arritshme brenda 5 min: {len(area)}")