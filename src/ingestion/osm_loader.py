"""
Ngarkuesi i rrjetit rrugor të Prishtinës nga OpenStreetMap.

Ky modul shkarkon rrjetin rrugor të qytetit, shton shpejtësitë
dhe kohët e udhëtimit, dhe e ruan si GraphML për përdorim të mëtejshëm.
"""

import os
import osmnx as ox
import networkx as nx


def download_prishtina_network(
    center: tuple = (42.6629, 21.1655),
    dist: int = 5000,
    network_type: str = "drive",
    save_path: str = "data/raw/osm/prishtina_network.graphml",
) -> nx.MultiDiGraph:
    """
    Shkarkon rrjetin rrugor të Prishtinës nga OpenStreetMap.

    Args:
        center: Koordinatat (lat, lon) të qendrës së Prishtinës.
        dist: Rrezja në metra nga qendra.
        network_type: Lloji i rrjetit ('drive', 'walk', 'bike', 'all').
        save_path: Rruga ku ruhet skedari GraphML.

    Returns:
        MultiDiGraph i NetworkX me rrjetin rrugor.
    """
    print(f"Duke shkarkuar rrjetin rrugor të Prishtinës ({dist}m rreze)...")
    G = ox.graph_from_point(center, dist=dist, network_type=network_type)

    print("Duke shtuar shpejtësitë e segmenteve...")
    G = ox.add_edge_speeds(G)

    print("Duke llogaritur kohët e udhëtimit...")
    G = ox.add_edge_travel_times(G)

    # Krijo dosjen nëse nuk ekziston
    os.makedirs(os.path.dirname(save_path), exist_ok=True)

    # Ruaj skedarin
    ox.save_graphml(G, save_path)
    print(f"Skedari u ruajt: {save_path}")

    # Statistika
    print(f"\n=== Statistika të Rrjetit ===")
    print(f"Nyje (intersections): {G.number_of_nodes():,}")
    print(f"Brinjë (roads): {G.number_of_edges():,}")

    stats = ox.basic_stats(G)
    print(f"Gjatësia totale e rrugëve: {stats['street_length_total']/1000:.2f} km")
    print(f"Numri i segmenteve: {stats['street_segment_count']:,}")

    return G


if __name__ == "__main__":
    G = download_prishtina_network()
    print("\nRrjeti rrugor u shkarkua me sukses!")