const COUNTRY_FLAGS: Record<string, string> = {
  'united states': '🇺🇸', usa: '🇺🇸',
  nigeria: '🇳🇬', india: '🇮🇳', china: '🇨🇳', 'south korea': '🇰🇷', korea: '🇰🇷',
  japan: '🇯🇵', vietnam: '🇻🇳', philippines: '🇵🇭', indonesia: '🇮🇩', pakistan: '🇵🇰',
  bangladesh: '🇧🇩', 'sri lanka': '🇱🇰', nepal: '🇳🇵', brazil: '🇧🇷', mexico: '🇲🇽',
  colombia: '🇨🇴', argentina: '🇦🇷', peru: '🇵🇪', chile: '🇨🇱', 'united kingdom': '🇬🇧',
  uk: '🇬🇧', france: '🇫🇷', germany: '🇩🇪', spain: '🇪🇸', italy: '🇮🇹', portugal: '🇵🇹',
  netherlands: '🇳🇱', poland: '🇵🇱', ukraine: '🇺🇦', russia: '🇷🇺', turkey: '🇹🇷',
  greece: '🇬🇷', sweden: '🇸🇪', norway: '🇳🇴', 'south africa': '🇿🇦', egypt: '🇪🇬',
  kenya: '🇰🇪', ghana: '🇬🇭', ethiopia: '🇪🇹', morocco: '🇲🇦', 'saudi arabia': '🇸🇦',
  'united arab emirates': '🇦🇪', uae: '🇦🇪', israel: '🇮🇱', jordan: '🇯🇴', lebanon: '🇱🇧',
  iran: '🇮🇷', iraq: '🇮🇶', canada: '🇨🇦', australia: '🇦🇺', 'new zealand': '🇳🇿',
  thailand: '🇹🇭', malaysia: '🇲🇾', singapore: '🇸🇬', taiwan: '🇹🇼', 'hong kong': '🇭🇰',
};

export function getCountryFlag(country: string | null | undefined): string {
  if (!country) return '🌍';
  return COUNTRY_FLAGS[country.toLowerCase().trim()] ?? '🌍';
}
