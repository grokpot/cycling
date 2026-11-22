/** Clean up song titles from file names. */

export function cleanSongTitle(filename: string): string {
  let title = filename

  // Strip file extension
  title = title.replace(/\.(mp3|flac|aac|m4a|wav|ogg|opus)$/i, '')

  // Strip common junk patterns
  title = title.replace(/[\[(](\d{2,3}kbps|320|256|192|128|v0|v2)[\])]/gi, '')
  title = title.replace(/[\[(]HD|HQ|FLAC|MP3|AAC|ALAC[\])]/gi, '')
  title = title.replace(/[\[(]official audio|official video|lyrics[\])]/gi, '')
  title = title.replace(/\s+-\s+Topic$/i, '') // YouTube auto-generated
  title = title.replace(/\s+remaster(ed)?(\s+\d{4})?/gi, '')

  // Clean up multiple spaces and trim
  title = title.replace(/\s{2,}/g, ' ').trim()

  // Replace underscores with spaces if no spaces exist
  if (!title.includes(' ') && title.includes('_')) {
    title = title.replace(/_/g, ' ')
  }

  return title || filename
}
