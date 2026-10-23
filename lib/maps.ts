/**
 * Enlace de búsqueda de Google Maps (Maps URLs, api=1): en el móvil abre la app de Google Maps si está
 * instalada y, si no, la web. https://developers.google.com/maps/documentation/urls/get-started
 */
export function googleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
}
