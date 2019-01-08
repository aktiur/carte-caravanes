import os
import json
import requests
import pandas as pd
from doit.tools import run_once, create_folder
from urllib.parse import quote_plus

os.environ['PATH'] = 'node_modules/.bin/' + os.pathsep + os.environ['PATH']


with open('caravanes.json') as f:
    CARAVANES = json.load(f)

VILLES = {etape['ville'] for caravane in CARAVANES.values() for etape in caravane}
GEOCODING_URL = "https://api-adresse.data.gouv.fr/search/?q={ville}'"


def task_geocoder():
    def geocoder_ville(ville):
        res = requests.get(GEOCODING_URL.format(ville=quote_plus(ville)))
        feature = res.json()['features'][0]

        return feature

    for ville in VILLES:
        yield {
            'name': ville,
            'actions': [(geocoder_ville, [ville], {})],
            'uptodate': [run_once]
        }


def task_create_geojson():
    def create_geojson(nom, etapes, targets, features):
        caravane = {"type": "FeatureCollection", "id": nom, "features": []}

        for etape in etapes:
            feature = features[etape['ville']].copy()
            feature['properties'] = {
                'ville': etape['ville'],
                'dates': etape['dates'],
            }
            caravane['features'].append(feature)

        with open(targets[0], 'w') as f:
            json.dump(caravane, f)

    for nom, etapes in CARAVANES.items():
        yield {
            'name': nom,
            'file_dep': ['caravanes.json'],
            'targets': ['build/caravane_{}.geojson'.format(nom)],
            'actions': [(create_folder, ['build']), (create_geojson, [nom, etapes], {})],
            'getargs': {'features': ('geocoder', None)}
        }


def task_extraire_hexagone():
    return {
        'file_dep': ['raw/departements.geojson'],
        'targets': ['build/hexagone.geojson'],
        'actions': ["""
            ndjson-split 'd.features' < %(dependencies)s \
            | ndjson-filter '!["2A", "2B"].includes(d.properties.code)' \
            | ndjson-reduce 'p.features.push(d),p' '{type:"FeatureCollection", features:[]}' > %(targets)s
        """]
    }


def task_creer_topologie():
    departements = 'build/hexagone.geojson'
    caravanes = {nom: 'build/caravane_{}.geojson'.format(nom) for nom in CARAVANES}
    caravanes_args = ' '.join(f'"{nom}={f}"' for nom, f in caravanes.items())

    return {
        'file_dep': [departements, *caravanes.values()],
        'targets': ['dist/topology.json'],
        'actions': [f"""
            geo2topo "departements={departements}" {caravanes_args} \
            | topomerge frontieres=departements \
            | topomerge --mesh -f "a != b" departements=departements \
            > %(targets)s
        """]
    }
