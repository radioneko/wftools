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

    def __init__(self, era, name, drop):
        self.era = era
        self.name = name
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
        if etree.iselement(n) and n.tag == 'table':
            return n
        n = n.getnext()
    raise Exception('table not found after "%s"' % h3.text)


# Parse relic drops from table node
def parse_relics(t):
    relics = []
    for n in t.xpath('tr/th[@colspan = 2]'):
        desc = n.text.lower().split(' ')
        if len(desc) > 3 and desc[2] == 'relic' and desc[3] == '(intact)':
            # read drop
            drop=[]
            tr = n.getparent().getnext()
            for i in range(6):
                cells = tr.findall('td')
                drop.append((cells[0].text, rarity_a2i[cells[1].text]))
                tr = tr.getnext()
            relics.append(Relic(desc[0], desc[1], drop))
            #print('%s %s => %s' % (desc[0], desc[1], ' || '.join(drop)))
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
r = root.xpath("//h3[text() = 'Relics:']")
t = h3_to_table(r[0])
rr = parse_relics(t)
print("function build_pool() { return [");
for r in rr:
    print("  {era: '%s', name: '%s', loot: %s}," % (r.era, r.name, r.loot()))
print("];}")

# Now make classifier function
classifier = build_classifier(rr)
print('var klassifier = ' + json.dumps(classifier) + ';')
print('function class_of(item) { return klassifier[item]; }')

# Make 'unabbrev' function
print('var unabb = ' + json.dumps(dict((v,k) for k,v in part_abname.items())) + ';')
print('function ab_decode(ab) { return unabb[ab] || ab; }')

#print(etree.tostring(n, pretty_print=True))
