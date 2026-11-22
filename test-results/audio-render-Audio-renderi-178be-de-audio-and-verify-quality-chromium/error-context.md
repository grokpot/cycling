# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: audio-render.spec.ts >> Audio rendering verification >> should render demo ride audio and verify quality
- Location: tests/audio-render.spec.ts:112:3

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 1.5
Received:   161.42857142857144
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "Audio Render Test Page" [level=1] [ref=e4]
    - paragraph [ref=e5]:
      - text: This page exposes
      - code [ref=e6]: window.renderAudioOffline(durationSeconds)
      - text: for Playwright tests.
    - paragraph [ref=e7]:
      - text: Open browser console and call
      - code [ref=e8]: await window.renderAudioOffline(60)
      - text: to render 60 seconds of audio.
  - generic [ref=e9]:
    - button "Nuxt DevTools" [ref=e10] [cursor=pointer]
    - dialog:
      - generic: Nuxt DevTools
      - paragraph: "Nuxt DevTools enables development features in your project. Install it with:"
      - generic:
        - code: npm i -D @nuxt/devtools@^4.2.0
        - button "Copy command"
      - generic:
        - generic:
          - button "Hide in this session"
          - button "Disable entirely"
        - button "Install Nuxt DevTools"
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  123 |     // Navigate to test page
  124 |     await page.goto('/test-audio-render')
  125 |     
  126 |     // Wait for page to be ready
  127 |     await page.waitForFunction(() => typeof (window as any).renderAudioOffline === 'function')
  128 |     
  129 |     // Render 3 minutes of audio (reduce from 6 to avoid memory issues)
  130 |     console.log('Rendering 3 minutes of demo ride audio...')
  131 |     
  132 |     let result
  133 |     try {
  134 |       result = await page.evaluate(async () => {
  135 |         try {
  136 |           return await (window as any).renderAudioOffline(180)
  137 |         } catch (err) {
  138 |           return { error: err.message, stack: err.stack }
  139 |         }
  140 |       })
  141 |     } catch (err) {
  142 |       console.error('Page evaluation failed:', err.message)
  143 |       throw err
  144 |     }
  145 |     
  146 |     if (result.error) {
  147 |       throw new Error(`Rendering failed: ${result.error}\n${result.stack}`)
  148 |     }
  149 |     
  150 |     const { samples: samplesArray, sampleRate, cues, songs } = result
  151 |     const samples = new Float32Array(samplesArray)
  152 |     
  153 |     console.log(`\n📊 Rendered ${samples.length} samples at ${sampleRate} Hz (${(samples.length / sampleRate).toFixed(1)}s)\n`)
  154 |     
  155 |     // Save WAV
  156 |     const wavPath = 'audio-verification-6min.wav'
  157 |     saveWAV(samples, sampleRate, wavPath)
  158 |     console.log(`💾 Saved WAV to ${wavPath}\n`)
  159 |     
  160 |     // Analyze per cue
  161 |     let currentSample = 0
  162 |     const results: any[] = []
  163 |     
  164 |     console.log('🎵 Per-Cue Analysis:\n')
  165 |     
  166 |     for (const cue of cues) {
  167 |       const cueSamples = Math.floor(cue.durationSeconds * sampleRate)
  168 |       const segment = samples.slice(currentSample, currentSample + cueSamples)
  169 |       
  170 |       // Find song info
  171 |       const song = songs.find((s: any) => s.id === cue.songId)
  172 |       const songBpm = song?.bpm ?? 0
  173 |       
  174 |       // Calculate expected tempo after stretch
  175 |       const targetBpm = cue.ratio === '2:1' ? cue.lockedRpm * 2 : cue.lockedRpm
  176 |       const expectedTempo = targetBpm / songBpm // This should be <1 for slowing down
  177 |       
  178 |       const rms = calculateRMS(segment)
  179 |       const measuredTempo = detectTempo(segment, sampleRate)
  180 |       const clicks = detectClicks(segment)
  181 |       const pitch = detectPitch(segment, sampleRate)
  182 |       
  183 |       // Tempo error (should be close to target BPM, not song BPM)
  184 |       const tempoError = Math.abs((measuredTempo - targetBpm) / targetBpm * 100)
  185 |       
  186 |       const result = {
  187 |         pieceIndex: cue.pieceIndex,
  188 |         songName: song?.name ?? cue.songId,
  189 |         songBpm,
  190 |         targetRpm: cue.lockedRpm,
  191 |         targetBpm,
  192 |         expectedTempo,
  193 |         measuredTempo,
  194 |         rms,
  195 |         clicks: clicks.length,
  196 |         pitch,
  197 |         tempoError
  198 |       }
  199 |       
  200 |       results.push(result)
  201 |       
  202 |       // Log with colors
  203 |       const statusEmoji = tempoError < 1.5 ? '✅' : '⚠️'
  204 |       console.log(`${statusEmoji} Cue ${cue.pieceIndex}: ${result.songName}`)
  205 |       console.log(`   Song: ${songBpm} BPM → Target: ${targetBpm} BPM (tempo: ${expectedTempo.toFixed(3)})`)
  206 |       console.log(`   Measured: ${measuredTempo} BPM (error: ${tempoError.toFixed(2)}%)`)
  207 |       console.log(`   RMS: ${rms.toFixed(4)}, Clicks: ${clicks.length}, Pitch: ${pitch.toFixed(1)} Hz`)
  208 |       console.log('')
  209 |       
  210 |       currentSample += cueSamples
  211 |     }
  212 |     
  213 |     console.log('\n🔍 Running Assertions...\n')
  214 |     
  215 |     // Assertions
  216 |     for (const result of results) {
  217 |       // RMS is clearly non-silent (threshold: 0.05)
  218 |       console.log(`Cue ${result.pieceIndex}: RMS ${result.rms} > 0.05`)
  219 |       expect(result.rms).toBeGreaterThan(0.05)
  220 |       
  221 |       // Tempo within 1.5% of target BPM
  222 |       console.log(`Cue ${result.pieceIndex}: Tempo error ${result.tempoError.toFixed(2)}% < 1.5%`)
> 223 |       expect(result.tempoError).toBeLessThan(1.5)
      |                                 ^ Error: expect(received).toBeLessThan(expected)
  224 |       
  225 |       // No excessive clicks (threshold: 10 for entire segment)
  226 |       console.log(`Cue ${result.pieceIndex}: Clicks ${result.clicks} < 10`)
  227 |       expect(result.clicks).toBeLessThan(10)
  228 |       
  229 |       // Verify stretch direction: for slowing down, expected tempo should be < 1.0
  230 |       if (result.songBpm > result.targetBpm) {
  231 |         console.log(`Cue ${result.pieceIndex}: Slowing down - tempo ${result.expectedTempo.toFixed(3)} < 1.0`)
  232 |         expect(result.expectedTempo).toBeLessThan(1.0)
  233 |       } else if (result.songBpm < result.targetBpm) {
  234 |         console.log(`Cue ${result.pieceIndex}: Speeding up - tempo ${result.expectedTempo.toFixed(3)} > 1.0`)
  235 |         expect(result.expectedTempo).toBeGreaterThan(1.0)
  236 |       }
  237 |     }
  238 |     
  239 |     console.log('\n✅ All assertions passed!\n')
  240 |   })
  241 | })
  242 | 
```