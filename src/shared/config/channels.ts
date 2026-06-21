/**
 * YouTube live financial-news channel registry (US / global broadcasters).
 *
 * Embeds use YouTube's `live_stream` format which auto-resolves to a channel's
 * currently-live broadcast: `https://www.youtube.com/embed/live_stream?channel=ID`.
 * If a channel is not live the embed degrades gracefully (handled in the UI).
 *
 * Channel ids reflect well-known public channels at time of authoring and may
 * need occasional verification.
 *
 * @module config/channels
 */

/** A YouTube live channel entry. */
export interface LiveChannel {
  id: string
  label: string
  /** YouTube channel id (the `UC...` identifier). */
  channelId: string
  /** Ready-to-use live_stream embed URL. */
  embedUrl: string
  /** Short category/region label. */
  category: string
}

function liveEmbed(channelId: string): string {
  return `https://www.youtube.com/embed/live_stream?channel=${channelId}`
}

function channel(id: string, label: string, channelId: string, category: string): LiveChannel {
  return { id, label, channelId, embedUrl: liveEmbed(channelId), category }
}

/** Curated US / global financial-news live channels. */
export const CHANNELS: readonly LiveChannel[] = [
  channel('cnbc', 'CNBC', 'UCvJJ_dzjViJCoLf5uKUTwoA', 'US Business'),
  channel('bloomberg', 'Bloomberg Television', 'UCIALMKvObZNtJ6AmdCLP7Lg', 'Global Markets'),
  channel('yahoo-finance', 'Yahoo Finance', 'UCEAZeUIeJs0IjQiqTCdVSIg', 'US Markets'),
  channel('bloomberg-originals', 'Bloomberg Originals', 'UCUMZ7gohGI9HcU9VNsr2FJQ', 'Global')
]

/**
 * Look up a channel by its internal id.
 *
 * @param id Channel id, e.g. `"cnbc"`.
 * @returns The {@link LiveChannel}, or `undefined` if not found.
 */
export function channelById(id: string): LiveChannel | undefined {
  return CHANNELS.find((c) => c.id === id)
}
