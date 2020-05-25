import sys
import json
import re
import os
import bs4
from app import app
from flask_frozen import Freezer


def to_vdom(elem, ignore=None):
    """Convert an element to json of mithril vnode."""
    ignore = ignore or set()
    if isinstance(elem, bs4.element.NavigableString):
        text = str(elem).strip()
        if not text:
            return None
        return {"tag": "#", "children": text}
    if elem.name in ignore:
        return None
    vdom = {
        "tag": elem.name,
        "attrs": dict(elem.attrs),
        "children": [c for c in map(to_vdom, elem.children)
                     if c is not None]
    }
    return {k: v for k, v in vdom.items() if v}

def clean_vdom(vdom, targets=None):
    targets = targets or set()
    if vdom['tag'] in targets:
        return None
    vdom = {**vdom,
            "children": [c for c in (clean_vdom(x, targets)
                                     for x in vdom.get("children", []))
                         if c is not None]}
    return {k: v for k, v in vdom.items() if v}

def walk(vdom):
    yield vdom
    yield from vdom.get('children', [])


def generate_assets(asset_file, output_dir):
    """Generate directory of assets from an aggregate SVG file."""
    soup = bs4.BeautifulSoup(open(asset_file).read(), 'html.parser')
    groups = soup.svg.find_all('g', recursive=False)
    rects = soup.defs.find_all('rect', recursive=False)
    directory_file = os.path.join(output_dir, 'directory.json')
    directory = []
    for g in groups:
        gid = g['id']
        match = re.match(r'(.+)/(.+)', gid)
        if not match:
            continue
        symbol, item = match.groups()
        path = os.path.join(output_dir, symbol)
        fname = os.path.join(path, f'{item}.json')
        os.makedirs(path, exist_ok=True)
        vdom = to_vdom(g)
        if symbol == 'a-person':
            vdom = clean_vdom(vdom, targets={'path'})
        vdom['tag'] = 'svg'
        vdom.setdefault('attrs', {})
        # this is a higher symbol, clean up sub content that was
        # exported
        new_children = []

        for child in vdom.get('children', []):
            for node in walk(child):
                node_attrs = node.get('attrs', {})
                node_cls = set(node_attrs.pop('class', '').split())
                node_id = node_attrs.pop('id', '').lower()
                if not node.get('children', []) and node['tag'] != 'path':
                    node_cls.add('symbol')
                if node_id:
                    node_cls.add(node_id)
                if node_cls:
                    node_attrs['class'] = ' '.join(node_cls)
                if node not in vdom['children']:
                    continue
                if node['tag'] == 'use':
                    xhref = node['attrs']['xlink:href'][1:]
                    rect = next((r for r in rects if r.attrs['id'] == xhref), None)
                    if rect:
                        w, h = rect.attrs['width'], rect.attrs['height']
                        vdom['attrs']['viewBox'] = f'0 0 {w} {h}'
                        vdom['attrs'].pop('width', None)
                        vdom['attrs'].pop('height', None)
                else:
                    new_children.append(child)

        vdom.pop('children', None)
        if new_children:
            vdom['children'] = new_children

        for attr in ('transform', 'clip-path'):
            vdom['attrs'].pop(attr, None)
        vdom_id = vdom['attrs'].pop('id', None)
        if vdom_id is not None:
            vdom['attrs']['class'] = " ".join(vdom_id.split("/"))
        vdom['attrs']['xmlns'] = "http://www.w3.org/2000/svg"

        with open(fname, 'w') as f:
            json.dump(vdom, f, indent=2)
        directory.append({
            'symbol': symbol,
            'id': item,
            'url': fname
        })
    with open(directory_file, 'w') as f:
        json.dump(directory, f, indent=2)


if __name__ == "__main__":
    generate_assets('open-peeps.svg', 'assets/peeps')
    freezer = Freezer(app)
    freezer.freeze()
    if 'debug' in sys.argv:
        freezer.serve()
