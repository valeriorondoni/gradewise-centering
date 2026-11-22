export interface LiveCatalogCard {
  id: string;
  name: string;
  set: string;
  number: string;
  rarity: string;
  imageUrl: string;
  largeImageUrl: string;
  rawMarketPriceEur: number;
}

interface PokemonTcgApiCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set?: {
    name?: string;
    printedTotal?: number;
  };
  images?: {
    small?: string;
    large?: string;
  };
  cardmarket?: {
    prices?: {
      trendPrice?: number;
      averageSellPrice?: number;
      lowPrice?: number;
    };
  };
  tcgplayer?: {
    prices?: Record<
      string,
      {
        market?: number;
        mid?: number;
      }
    >;
  };
}

function extractPriceEur(card: PokemonTcgApiCard): number {
  const cm = card.cardmarket?.prices;
  if (cm?.trendPrice && cm.trendPrice > 0) return Math.round(cm.trendPrice);
  if (cm?.averageSellPrice && cm.averageSellPrice > 0) return Math.round(cm.averageSellPrice);
  if (cm?.lowPrice && cm.lowPrice > 0) return Math.round(cm.lowPrice);

  const tcgPrices = card.tcgplayer?.prices;
  if (tcgPrices) {
    const first = Object.values(tcgPrices)[0];
    if (first?.market && first.market > 0) return Math.round(first.market * 0.92);
    if (first?.mid && first.mid > 0) return Math.round(first.mid * 0.92);
  }
  return 45;
}

export async function searchPokemonCards(query: string): Promise<LiveCatalogCard[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const q = encodeURIComponent(`name:*${trimmed}*`);
  const url = `https://api.pokemontcg.io/v2/cards?q=${q}&pageSize=8&orderBy=-set.releaseDate`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Pokémon TCG API returned ${res.status}`);
  }

  const json = (await res.json()) as { data?: PokemonTcgApiCard[] };
  const cards = json.data || [];

  return cards.map((c) => {
    const printedTotal = c.set?.printedTotal;
    const numStr = printedTotal ? `${c.number}/${printedTotal}` : c.number;
    return {
      id: c.id,
      name: c.name,
      set: c.set?.name || 'Pokémon TCG',
      number: numStr,
      rarity: c.rarity || 'Holo',
      imageUrl: c.images?.small || '',
      largeImageUrl: c.images?.large || c.images?.small || '',
      rawMarketPriceEur: extractPriceEur(c),
    };
  });
}

export async function fetchRandomLiveCards(count = 3): Promise<LiveCatalogCard[]> {
  const randomPage = Math.floor(1 + Math.random() * 25);
  const q = encodeURIComponent('supertype:Pokémon (rarity:"Rare Holo" OR rarity:"Rare Holo V" OR rarity:"Illustration Rare")');
  const url = `https://api.pokemontcg.io/v2/cards?q=${q}&page=${randomPage}&pageSize=${count}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Pokémon TCG API returned ${res.status}`);
  }

  const json = (await res.json()) as { data?: PokemonTcgApiCard[] };
  const cards = json.data || [];

  return cards.map((c) => {
    const printedTotal = c.set?.printedTotal;
    const numStr = printedTotal ? `${c.number}/${printedTotal}` : c.number;
    return {
      id: c.id,
      name: c.name,
      set: c.set?.name || 'Pokémon TCG',
      number: numStr,
      rarity: c.rarity || 'Holo',
      imageUrl: c.images?.small || '',
      largeImageUrl: c.images?.large || c.images?.small || '',
      rawMarketPriceEur: extractPriceEur(c),
    };
  });
}
