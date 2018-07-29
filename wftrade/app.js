var loc_ru = {axi: 'акси',// l_axi: 'реликвия акси',
			  neo: 'нео',
			  meso: 'мезо',
			  lith: 'лит',
			  cost_each: function(cost) { return 'по ' + cost.toString() + 'п'; },
			  cost_pack: function(cost) { return '5к' + cost.toString(); },
			 };
var loc_en = {axi: 'Axi',
			  neo: 'Neo',
			  meso: 'Meso',
			  lith: 'Lith',
			  cost_each: function(cost) { return cost.toString() + 'p each'; },
			  cost_pack: function(cost) { return '5:' + cost.toString() + 'p'; },
			 }

// search history
var s_history = new Array();
var s_index = -1;

var rarity_map = new Map([
	["rare", 2],     ["r", 2], ["2", 2],
	["uncommon", 1], ["u", 1], ["1", 1],
	["common", 0],   ["c", 0], ["0", 0]
]);

var era_map = new Map([
	["axi", "axi"], ["a", "axi"],
	["neo", "neo"], ["n", "neo"],
	["meso", "meso"], ["m", "meso"],
	["lith", "lith"], ["l", "lith"]
]);

var era_order = {'lith': 0, 'meso': 1, 'neo': 2, 'axi': 3}

function push_relics(bo, arr, name) {
	if (arr.length) {
		bo.push(name + ' ' + arr.join('/'));
	}
}


function RelicPack()
{
	this.axi = new Array();
	this.neo = new Array();
	this.meso = new Array();
	this.lith = new Array();
	this.add = function(relic) {
		var arr = undefined;
		switch (relic.era) {
			case 'axi':		arr = this.axi; break;
			case 'neo':		arr = this.neo; break;
			case 'meso':	arr = this.meso; break;
			case 'lith':	arr = this.lith; break;
		}
		relic_id = relic.name.toUpperCase();
		for (var i = 0; i < arr.length; i++) 
			if (arr[i] == relic_id)
				break;
		if (i == arr.length) {
			arr.push(relic_id);
			arr.sort();
		}
		return this;
	}
	this.str = function(l18n) {
		var relics = new Array();
		push_relics(relics, this.axi, l18n.axi);
		push_relics(relics, this.neo, l18n.neo);
		push_relics(relics, this.meso, l18n.meso);
		push_relics(relics, this.lith, l18n.lith);
		return relics.join(', ');
	}
}


// deeply clone relic object
function dup(relic) {
	return JSON.parse(JSON.stringify(relic));
}


// merge loot table by removing duplicates
function merge_loot_tables(aloot) {
	var m = new Map();
	aloot.forEach(function(loot, idx, arr) {
		loot.forEach(function(item, idx, arr) {
			m.set(JSON.stringify(item), item);
		})
	})
	var loot = new Array();
	m.forEach(function(val, key, map) {
		loot.push(val);
	})
	return loot;
}

// return false if filter returned empty loot list or relic copy
function filter_loot(relic, filter) {
	var items = relic.loot.filter(function(x) {
		return filter(x.rty, x.item, x.sub);
	});
	if (items.length == 0)
		return false;
	var filtered = dup(relic);
	filtered.loot = items;
	return filtered;
}


function PredicateEra(era) {
	this.era = era.toLowerCase();
	this.check = function(relic) {
		if (relic.era == this.era)
			return relic;
		return false;
	}
	this.print = function() {
		return "era == " + this.era;
	}
}


function PredicateRelic(rid) {
	this.era = era_map.get(rid.charAt(0));
	this.name = rid.substring(1);
	this.check = function(relic) {
		if (relic.era == this.era && relic.name == this.name)
			return relic;
		return false;
	}
	this.print = function() {
		return this.era + " " + this.name.toUpperCase();
	}
}


function PredicateName(name) {
	this.name = name.toLowerCase(name);
	this.check = function(relic) {
		if (relic.name == this.name)
			return relic;
		return false;
	}
	this.print = function() {
		return "name == " + this.name;
	}
}

// filter loot table by item name
function PredicateItem(name) {
	this.name = name.toLowerCase();
	this.check = function(relic) {
		var val = this.name;
		return filter_loot(relic, function(rarity, item, type) {
			return item == val || item.substring(0, val.length + 1) == val + ' ';
		});
	}
	this.print = function() {
		return '#' + this.name;
	}
}


// filter loot table by item type
function PredicateType(type) {
	this.type = type.toLowerCase();
	this.check = function(relic) {
		var val = this.type;
		return filter_loot(relic, function(rarity, item, type) {
			return type == val;
		});
	};
	this.print = function() {
		return "/" + this.type;
	}
}

// filter loot table by item rarity
function PredicateRarity(rty) {
	if (rarity_map.has(rty)) {
		this.rty = rarity_map.get(rty);
		this.check = function(relic) {
			var rty = this.rty;
			return filter_loot(relic, function(rarity, item, type) {
				return rarity == rty;
			});
		};
		this.print = function() { return "@" + ["common", "uncommon", "rare"][this.rty]; }
	} else {
		this.check = function(relic) { return false; };
		this.print = function() { return "BAD_RARITY"; }
	}
}

// filter by relic's vaulted flag
function PredicateVaulted(is_vaulted)
{
	this.is_vaulted = is_vaulted;
	this.check = function(relic) {
		return relic.is_vaulted == this.is_vaulted ? relic : false;
	};
	this.print = function() {
		return this.is_vaulted ? '*' : '**';
	};
}

function PredicateAll() {
	this.cond = new Array();
	this.check = function(relic) {
		var loot = new Array();
		var success = true;
		this.cond.forEach(function(pred, arr) {
			if (success) {
				var r = pred.check(relic);
				if (r)
					loot.push(r.loot);
				else
					success = false;
			}
		});
		if (!success)
			return false;
		var r = dup(relic);
		r.loot = merge_loot_tables(loot);
		return r;
	}
	this.push = function(pred) {
		this.cond.push(pred);
	}
}


// "any" predicate: apply all predicates then merge results
function PredicateAny()
{
	this.cond = new Array();
	this.check = function(relic) {
		var loot = new Array();
		var success = false;
		this.cond.forEach(function(pred, arr) {
			var r = pred.check(relic);
			if (r) {
				loot.push(r.loot);
				success = true;
			}
		});
		if (!success)
			return false;
		var r = dup(relic);
		r.loot = merge_loot_tables(loot);
		return r;
	}
	this.push = function(pred) {
		this.cond.push(pred);
	}
}

function predicate_from_single_token(token)
{
	if (token == '*')
		return new PredicateVaulted(true);
	if (token == '**')
		return new PredicateVaulted(false);
	switch (token.charAt(0)) {
	case '#':	return new PredicateItem(token.substring(1));
	case '@':   return new PredicateRarity(token.substring(1));
	case '/':   return new PredicateType(token.substring(1));
	}
	if (era_map.has(token))
		return new PredicateEra(era_map.get(token));
	if (token.length == 3 && era_map.has(token.charAt(0))) {
		return new PredicateRelic(token);
	}
	if (token.length == 2) {
		return new PredicateName(token);
	}
	return false;
}

function predicate_from_token(token)
{
	var t_pre = '', t_body = token;
	switch (token.charAt(0)) {
	case '#': case '@': case '/':
		t_pre = token.charAt(0);
		t_body = token.substring(1);
	}
	var pred = false, tokens;
	if (t_body.indexOf(',') != -1) {
		pred = new PredicateAny();
		tokens = t_body.split(',');
	} else if (t_body.indexOf('+') != -1) {
		pred = new PredicateAll();
		tokens = t_body.split('+');
	}

	if (pred) {
		tokens.forEach(function (elt) {
			pred.push(predicate_from_single_token(t_pre + elt));
		});
		return pred;
	} else {
		return predicate_from_single_token(token);
	}
}

// parse query into array of orders
// nv1:10 #nyx/cha,neu:10 #ash/bp@u:5
// n#nova => neo relics with nova parts
// #ash@u => relics with uncommon ash parts
// a#ash@u => axi relics with uncommon ash parts
// #nyx@r,u => relics with nyx rare and uncommon parts
function parse(query) {
	var pred = new Array();
	/* "tokenize" query string */
	var tokens = new Array();
	var token = "";
	for (var i = 0; i < query.length; i++) {
		var ch = query.charAt(i);
		if ((ch == '#' || ch == '/' || ch == '@' || (ch == '*' && token != '*')) && token.length > 0) {
			pred.push(predicate_from_token(token));
			token = "";
		}
		token += ch;
	}
	if (token.length > 0)
		pred.push(predicate_from_token(token));

	return pred;
}


function wiki_url(item, sub)
{
	var cname = item.split(' ').map(function (it, idx, arr) { return it.charAt(0).toUpperCase() + it.slice(1); }).join('_')
		  + (class_of(item) == 'warframe' ? '/' : '_') + 'Prime';
	return 'http://warframe.wikia.com/wiki/' + escape(cname);
}

/* return url of market page for corresponding item and subtype */
function market_url(item, sub)
{
	var cname = item + ' prime ' + ab_decode(sub);
	switch (class_of(item)) {
	case 'warframe':
	case 'archwing':
		if (sub != 'bp')
			cname = cname.replace(' blueprint', '');
		break;
	}
	return 'https://warframe.market/items/' + cname.replace(/ /g, '_');
}

/* Capitalize words separated by spaces */
function capitalize(str)
{
	return str.split(' ').map(function (it, idx, arr) { return it.charAt(0).toUpperCase() + it.slice(1); }).join(' ');
}

/* Capitalize and add 'Prime' suffix */
function pretty_prime_name(item)
{
	return item == 'forma'
		? 'Forma'
		: capitalize(item) + ' Prime';

}

function pretty_sub_name(item, sub)
{
	if (item == 'forma')
		return 'Forma';
	return capitalize(item + ' prime ' + ab_decode(sub));
}

function hide_popup()
{
	$('#popup').hide();
	return true;
}

function item_clicked(event, item, sub)
{
	event.preventDefault();
	event.stopPropagation();
	/* build canonical item name */
	$('.tt_item').text(pretty_prime_name(item));
	$('.tt_sub').text(pretty_sub_name(item, sub));
	$('#popup').hide();
	/* prepare menu */
	// navigate to warframe wiki page
	$('#popup_wiki')
		.attr('href', wiki_url(item, sub));
	$('#popup_market')
		.attr('href', market_url(item, sub));
	$('#popup_prime').off('click').click(function() {
		$('#query').val('#' + item);
		$('#popup').hide();
		find_clicked();
		return false;
	});
	$('#popup_part').off('click').click(function() {
		$('#query').val('#' + item + '/' + sub);
		$('#popup').hide();
		find_clicked();
		return false;
	});
	$('#popup').css({'position': 'fixed', 'left': event.clientX, 'top': event.clientY}).show();
}

function relic_clicked(event, era, name)
{
	$('#query').val(era.charAt(0) + name);
	find_clicked();
	return false;
}

function pred_apply(pred) {
	var p = build_pool();
	var out = new Array();
	p.forEach(function(value, arr) {
		var r = pred.reduce(function(state, predicate, idx, arr) {
			return state ? predicate.check(state) : false;
		}, value);
		if (r)
			out.push(r);
	});
	out.sort(function(a,b) {
		var ea = era_order[a.era], eb = era_order[b.era];
		if (ea != eb)
			return ea < eb ? -1 : 1;
		return a.name < b.name ? -1 : 1;
	});
	return out;
}

function process() {
	var pred = parse($('#query').val());
	if (!pred)
		return false;
	var out = pred_apply(pred);
	var html = "<table class=\"rewards\"><tr><th>Relic</th><th>Rare</th><th>Uncommon</th><th>Common</th>";
	out.forEach(function(r, idx, arr) {
		html += "<tr><td class=\"relic"
			 + (r.is_vaulted ? ' vaulted' : '')
			 + "\" onclick=\"relic_clicked(event, '" + r.era + "', '" + r.name + "')\">"
		     + r.era + "&nbsp;" + r.name.toUpperCase();
		var rt = [new Array(), new Array(), new Array()];
		r.loot.forEach(function(l, idx, arr) {
			rt[l.rty].push("<div"
							+ (l.is_vaulted ? ' class="vaulted"' : '')
							+ " onclick=\"item_clicked(event, '" + l.item + "', '" + l.sub + "')\">" + l.item + "/" + l.sub + "</div>");
		});
		for (var i = 2; i >= 0; i--)
			html += '<td class="r' + i + '">' + rt[i].join('');
	});
	html += "</table>";
	$("#out").html(html);
	return true;
}


function update_history_state()
{
	$('#forward').prop('disabled', s_index + 2 >= s_history.length);
	$('#back').prop('disabled', s_index < 0);
}

function find_clicked()
{
	if (process()) {
		if (s_history.length == 0) {
			s_history.push($('#query').val());
			s_index = -1;
		} else {
			s_history.splice(s_index + 2, s_history.length, $('#query').val());
			s_index++;
		}
		update_history_state();
	}
	return true;
}


$(document).ready(function() {
	s_history = new Array();
	s_index = -1;
	update_history_state();
	$("#query").on({
		keyup: function(event) {
			if (event.keyCode == 13)
				find_clicked();
		}
	});
	$("#find").click(find_clicked);
	$("#helpme").click(function() {
		$("#help").toggle();
	});
	$('#popup_wiki').click(hide_popup);
	$('#popup_market').click(hide_popup);
	$('#back').click(function() {
		if (s_index >= 0) {
			$('#query').val(s_history[s_index]);
			s_index--;
			process();
			update_history_state();
		}
	});
	$('#forward').click(function() {
		if (s_index + 2 < s_history.length) {
			$('#query').val(s_history[s_index + 2]);
			s_index++;
			process();
			update_history_state();
		}
	});
	$(window).click(function(event) {
		if (!event.target.matches('table.rewards div'))
			hide_popup();
		return true;
	});
});
