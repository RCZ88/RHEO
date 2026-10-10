import type { PageManifest } from '../types'

/**
 * /transcripts — the saved dictation library.
 *
 * The dictation widget saves every finished recording into `stt_transcripts`
 * and copies it to the clipboard. Until this page existed those transcripts had
 * nowhere to be read from again, which made "it saved" indistinguishable from
 * "it vanished" — the widget could only show the last handful.
 *
 * `data-page="stt"` is deliberate: index.css already declares
 * `[data-page="stt"] { --page-accent: #8b5cf6 }`, so the page gets its signal hue
 * from the same token the widget uses rather than inventing one.
 */
const transcripts: PageManifest = {
  id: 'transcripts',
  route: '/transcripts',
  label: 'Transcripts',
  icon: 'FileText',
  group: 'Intelligence',
  keywords: [
    'transcript',
    'transcripts',
    'dictation',
    'speech to text',
    'speech-to-text',
    'stt',
    'voice',
    'whisper',
    'notes',
    'saved speech',
  ],
  hint: 'Every dictation you have spoken, transcribed on-device',

  aliases: ['stt', 'speech-to-text', 'dictation', 'voice-notes'],

  sections: [
    {
      id: 'transcripts.all',
      label: 'Transcripts — All',
      icon: 'FileText',
      keywords: ['all', 'list', 'history', 'saved'],
      hint: 'Everything captured by the dictation widget',
    },
    {
      id: 'transcripts.search',
      label: 'Transcripts — Search',
      icon: 'Search',
      keywords: ['search', 'find', 'filter', 'grep'],
      hint: 'Find a phrase inside a saved transcript',
    },
    {
      id: 'transcripts.how',
      label: 'Transcripts — How it works',
      icon: 'CircleHelp',
      keywords: ['about', 'engine', 'on-device', 'privacy', 'install'],
      hint: 'Where transcription runs, and how to turn it on',
    },
  ],
}

export default transcripts