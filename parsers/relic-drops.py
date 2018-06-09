#! /usr/bin/env python3
import lxml.etree as etree
import lxml.html
import sys
import collections
import json

part_abname = {'blueprint': 'bp',
               'systems blueprint' : 'sys',
               'chassis blueprint': 'cha',
               'neuroptics blueprint': 'neu',
               'harness blueprint': 'har',
               'wings blueprint': 'win',
               'barrel': 'ba',
               'receiver' : 're',
               'stock' : 'st',
                }

klassifier = {'sys':   'warframe',
              'win':   'archwing',
              'ba':    'weapon',
              'hilt':  'weapon',
              'blade': 'weapon',
              }

rarity_a2i = {'Rare (2.00%)': 2, 'Uncommon (11.00%)': 1, 'Uncommon (25.33%)': 0}

# abbreviate part name
def part_abbrev(pn):
    ab_name = part_abname.get(pn)
    if ab_name is not None:
        return ab_name
    if pn[-10:] == ' blueprint':
        return pn[0:len(pn) - 10]
    return pn


# make reward name 'canonic' by converting it to lower case
# and removing 'prime' and 'blueprint'
def canonic_reward_name(name):
    cn = name.lower().split(' prime ')
    if len(cn) > 1:
        return cn[0] + '/' + part_abbrev(cn[1])
    return '--'.join(cn)


class Relic:
    # make canonic triplet out of item name
    # 1. convert to lower case
    # 2. remove " prime " from name
    # 3. abbreviate blueprint,systems etc
    def canonic_item(rarity, name):
        cn = name.lower().split(' prime ')
        if len(cn) > 1 and part_abname.get(cn[1]):
            cn[1] = part_abname[cn[1]]
        # Special case: "forma blueprint"
        if len(cn) == 1 and cn[0] == "forma blueprint":
            cn[0] = "forma"
            cn.append("bp")
        return (rarity, cn[0], cn[1] if len(cn) > 1 else '')

    def __init__(self, era, name, drop, is_vaulted):
        self.era = era
        self.name = name
        self.is_vaulted = is_vaulted
        self.drop = [Relic.canonic_item(x[1], x[0]) for x in drop]
    
    def ppdrop(self, n):
        cc = None;
        if n == 0:
            cc = '\033[1;33m'
        elif n in [1,2]:
            cc = '\033[0m'
        else:
            cc = '\033[0;33m'
        if cc:
            return cc + self.drop[n] + '\033[0m'
        else:
            return self.drop[n]

    def loot(self):
        return list(map(lambda x: list(x), self.drop))

    def key(self):
        era_map = {'axi': 'a', 'neo': 'n', 'meso': 'm', 'lith': 'l'}
        return era_map[self.era] + self.name

# Find following table node
def h3_to_table(h3):
    n = h3.getnext()
    while n is not None:
        if n.tag == 'h3':
            return None
        if etree.iselement(n) and n.tag == 'table' and n.find('tr') is not None:
            return n.find('tr')
        n = n.getnext()
    return n


# Check return "class" of tr element
# 1 => start of table
# 2 => end of table
# 0 => intermediate row
def classify_tr(tr):
    if tr is None or tr.attrib.get('class') == 'blank-row':
        return 2
    if tr.find('th') is not None:
        return 1
    return 0

# Extract array or table rows from 'tr/th' till empty line
# return triplet (next-row, table-header, table-rows)
def extract_table(tr):
    # Find "header"
    while classify_tr(tr) not in (1, 2):
        tr = tr.getnext()
    if tr is None:
        return (None, None, None)

    # Process "body"
    rows = []
    name = tr.find('th').text
    tr = tr.getnext()
    while classify_tr(tr) != 2:
        row = [cell.text for cell in tr.findall('th') or tr.findall('td')]
        rows.append(row)
        tr = tr.getnext()

    return (tr.getnext() if tr is not None else None, name, rows)

# Extract tables collection after header
# 1) find h3 containing specified text
def extract_tables(root):
    sections = root.xpath('//h3')
    data = dict()
    for h in sections:
        items = []
        tr = h3_to_table(h)
        while tr is not None:
            (tr, name, rows) = extract_table(tr)
            if name is not None:
                items.append((name, rows))
        data[h.text] = items
    return data



def grep_relic_rewards(missions):
    relics = []
    for m in missions:
        for rw in m[1]:
            r = rw[0 if len(rw) <= 2 else 1].lower().split(' ')
            if len(r) == 3 and r[2] == 'relic':
                relics.append(r[0] + ' ' + r[1])
    return relics

# Parse relic drops from table node
def parse_relics(t):
    # Find all droppable relics
    droppable_relics = set()
    droppable_relics.update(grep_relic_rewards(t['Missions:']))
    droppable_relics.update(grep_relic_rewards(t['Cetus Bounty Rewards:']))

    # Fill relics array
    relics = []
    for n in t['Relics:']:
        desc = n[0].lower().split(' ')
        if len(desc) > 3 and desc[2] == 'relic' and desc[3] == '(intact)':
            # read drop
            drop = []
            for cells in n[1]:
                drop.append((cells[0], rarity_a2i[cells[1]]))
            relics.append(Relic(desc[0], desc[1], drop, (desc[0] + ' ' + desc[1]) not in droppable_relics))
    return relics


# Prepare function to classify items by name
def build_classifier(rr):
    cls = dict()
    for r in rr:
        for l in r.drop:
            if klassifier.get(l[2]):
                cls[l[1]] = klassifier[l[2]]
    return cls

doc = lxml.html.parse(sys.argv[1])
root = doc.getroot()
tbl = extract_tables(root)
rr = parse_relics(tbl)
print("function build_pool() { return [");
for r in rr:
    print("  {era: '%s', name: '%s', is_vaulted: %s, loot: %s}," % (r.era, r.name, 'true' if r.is_vaulted else 'false', r.loot()))
print("];}")

# Now make classifier function
classifier = build_classifier(rr)
print('var klassifier = ' + json.dumps(classifier) + ';')
print('function class_of(item) { return klassifier[item]; }')

# Make 'unabbrev' function
print('var unabb = ' + json.dumps(dict((v,k) for k,v in part_abname.items())) + ';')
print('function ab_decode(ab) { return unabb[ab] || ab; }')

#print(etree.tostring(n, pretty_print=True))
